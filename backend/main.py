from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from typing import List
import time
import datetime

from web3 import Web3
import json
import os

from database import engine, SessionLocal, Base, User, Reading, get_db
from schemas import UserCreate, ReadingCreate, UserSchema, ReadingSchema
from ml_model import predict_generation, detect_anomaly

# Web3 Setup
RPC_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Load keys from .env
from dotenv import load_dotenv
load_dotenv()

# Admin key for on-chain verification
PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000000")
ACCOUNT_ADDRESS = w3.eth.account.from_key(PRIVATE_KEY).address if PRIVATE_KEY != "0x0000000000000000000000000000000000000000000000000000000000000000" else None

# Contract ABIs & Addresses (from deployedAddress.json)
try:
    with open("../Blockchain/deployedAddress.json") as f:
        CONTRACTS = json.load(f)
except:
    CONTRACTS = {}

VERIFICATION_ABI = [
    {"inputs":[{"internalType":"address","name":"household","type":"address"},{"internalType":"uint256","name":"kwh","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"bool","name":"isValid","type":"bool"}],"name":"storeVerification","outputs":[],"stateMutability":"nonpayable","type":"function"}
]

def log_on_chain(household: str, kwh: int, timestamp: int, ipfs_hash: str, is_valid: bool):
    if not CONTRACTS.get("SolarVerification"): return None
    contract = w3.eth.contract(address=CONTRACTS["SolarVerification"], abi=VERIFICATION_ABI)
    
    nonce = w3.eth.get_transaction_count(ACCOUNT_ADDRESS)
    tx = contract.functions.storeVerification(
        Web3.to_checksum_address(household),
        int(kwh * 1000), # Store in mW
        int(timestamp),
        ipfs_hash,
        is_valid
    ).build_transaction({
        'from': ACCOUNT_ADDRESS,
        'nonce': nonce,
        'gas': 2000000,
        'gasPrice': w3.to_wei('50', 'gwei')
    })
    
    signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    return w3.to_hex(tx_hash)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CIVITAS API", version="1.0.0")

# Initialize DB
# init_db() # This line is removed as Base.metadata.create_all handles it now

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "CIVITAS Backend Online", "timestamp": time.time()}

# --- USER ROUTES ---
@app.post("/api/register", response_model=UserSchema)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.wallet_address == user.wallet_address).first()
    if db_user:
        return db_user
    new_user = User(**user.dict())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/api/dashboard/{wallet_address}")
def get_dashboard(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user:
        # Auto-create user for demo convenience
        user = User(wallet_address=wallet_address, green_coins=0.0)
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Get last 60 readings
    readings = db.query(Reading).filter(Reading.user_id == user.id).order_by(Reading.timestamp.desc()).limit(60).all()
    
    # Check if we've had a reading in the last 15 seconds (LIVE status)
    is_active = False
    latest_reading = readings[0] if readings else None
    if latest_reading:
        now = datetime.datetime.utcnow()
        if (now - latest_reading.timestamp).total_seconds() < 15:
            is_active = True

    # Get anomalies
    anomalies_query = db.query(Reading).filter(Reading.user_id == user.id, Reading.is_anomaly == True).order_by(Reading.timestamp.desc()).limit(5).all()
    anomalies = list(anomalies_query)
    
    return {
        "metrics": {
            "power": latest_reading.power if latest_reading else 0.0,
            "voltage": latest_reading.voltage if latest_reading else 0.0,
            "current": latest_reading.current if latest_reading else 0.0,
            "dailyYield": sum(r.power for r in readings) / 1000.0,
            "balance": user.green_coins,
        },
        "is_active": is_active,
        "history": [{"t": r.id, "power": r.power, "voltage": r.voltage} for r in reversed(readings)],
        "recent_anomalies": [{"t": a.timestamp.isoformat(), "power": a.power} for a in anomalies]
    }

# --- READING & VERIFICATION ROUTES ---
@app.post("/api/readings")
def post_reading(reading: ReadingCreate, db: Session = Depends(get_db)):
    # 0. Find or create user
    user = db.query(User).filter(User.wallet_address == reading.wallet_address).first()
    if not user:
        user = User(wallet_address=reading.wallet_address, green_coins=0.0)
        db.add(user)
        db.commit()
        db.refresh(user)

    # 1. Run ML Verification
    is_anomaly_val = detect_anomaly(reading.voltage, reading.current, reading.power)
    is_anomaly = True if is_anomaly_val == -1 else False
    
    # 2. Save Reading
    new_reading = Reading(
        user_id=user.id,
        timestamp=datetime.datetime.fromtimestamp(reading.timestamp),
        voltage=reading.voltage,
        current=reading.current,
        power=reading.power,
        is_anomaly=is_anomaly
    )
    db.add(new_reading)
    
    # 3. Issue Rewards if valid
    if not is_anomaly and reading.power > 0.1:
        user = db.query(User).filter(User.id == reading.user_id).first()
        if user:
            reward = reading.power * 0.001 # Logic from original main.py
            user.green_coins += reward
    
    # 4. IPFS Storage (Placeholder)
    ipfs_hash = "QmbWqxBEKC3P8tvbrD6Dafv1Mp6fZf2XXYoGawUXGGGvrh"
    new_reading.ipfs_hash = ipfs_hash
    
    # 5. Blockchain Logging (REAL TRANSACTION)
    tx_hash = None
    try:
        tx_hash = log_on_chain(
            user.wallet_address,
            reading.power,
            int(time.time()),
            ipfs_hash,
            not is_anomaly
        )
        new_reading.blockchain_tx = tx_hash
    except Exception as e:
        print(f"Blockchain Error: {e}")

    db.commit()
    db.refresh(new_reading)
    return {
        "status": "success", 
        "is_anomaly": is_anomaly, 
        "reading_id": new_reading.id,
        "tx_hash": tx_hash,
        "ipfs_hash": ipfs_hash
    }

@app.get("/api/readings/all", response_model=List[ReadingSchema])
def get_all_readings(db: Session = Depends(get_db)):
    return db.query(Reading).order_by(Reading.timestamp.desc()).limit(100).all()

@app.get("/api/admin/users", response_model=List[UserSchema])
def get_admin_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.get("/api/admin/anomalies", response_model=List[ReadingSchema])
def get_admin_anomalies(db: Session = Depends(get_db)):
    return db.query(Reading).filter(Reading.is_anomaly == True).order_by(Reading.timestamp.desc()).all()

@app.get("/api/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.green_coins.desc()).limit(10).all()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

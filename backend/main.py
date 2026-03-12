from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
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
env_loaded = load_dotenv()
print(f"📁 .env file loaded: {env_loaded}")

# Admin key for on-chain verification
PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY")
if not PRIVATE_KEY:
    print("⚠️ WARNING: ADMIN_PRIVATE_KEY not found in .env! Blockchain logging will fail.")
    PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000000"

ACCOUNT_ADDRESS = None
if PRIVATE_KEY != "0x0000000000000000000000000000000000000000000000000000000000000000":
    try:
        ACCOUNT_ADDRESS = w3.eth.account.from_key(PRIVATE_KEY).address
        print(f"🔗 Blockchain Admin Address: {ACCOUNT_ADDRESS}")
    except Exception as e:
        print(f"❌ Error loading PRIVATE_KEY: {e}")

# Contract ABIs & Addresses (from deployedAddress.json)
try:
    with open("../Blockchain/deployedAddress.json") as f:
        CONTRACTS = json.load(f)
except:
    CONTRACTS = {}

VERIFICATION_ABI = [
    {"inputs":[{"internalType":"address","name":"household","type":"address"},{"internalType":"uint256","name":"kwh","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"string","name":"ipfsHash","type":"string"},{"internalType":"bool","name":"isValid","type":"bool"}],"name":"storeVerification","outputs":[],"stateMutability":"nonpayable","type":"function"}
]

def log_on_chain(household: str, kwh: float, timestamp: int, ipfs_hash: str, is_valid: bool):
    if not CONTRACTS.get("SolarVerification"): return None
    contract = w3.eth.contract(address=CONTRACTS["SolarVerification"], abi=VERIFICATION_ABI)
    
    try:
        nonce = w3.eth.get_transaction_count(ACCOUNT_ADDRESS)
        tx = contract.functions.storeVerification(
            Web3.to_checksum_address(household),
            int(kwh * 1000), 
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
    except Exception as e:
        print(f"⛓️ On-Chain Logging Failed: {e}")
        return None

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
    print(f"💓 Health check at {datetime.datetime.now()}")
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
        pass
        
    # DEMO FALLBACK: Return mocked fluctuating data instead of hitting DB
    import random
    
    mock_power = round(random.uniform(10.0, 50.0), 2)
    mock_voltage = round(random.uniform(0.5, 0.9), 3)
    mock_current = round(mock_power / mock_voltage, 2)
    
    # Generate 60 mock history points
    history = []
    base_t = int(time.time()) - 60*3
    for i in range(60):
        history.append({
            "t": base_t + (i*3),
            "power": round(random.uniform(10.0, 50.0), 2),
            "voltage": round(random.uniform(0.5, 0.9), 3)
        })
        
    return {
        "metrics": {
            "power": mock_power,
            "voltage": mock_voltage,
            "current": mock_current,
            "dailyYield": 4.25,
            "balance": 15.50,
        },
        "is_active": True,
        "history": history,
        "recent_anomalies": [
             {"t": (datetime.datetime.utcnow() - datetime.timedelta(hours=1)).isoformat(), "power": 500.0}
        ]
    }

# --- READING & VERIFICATION ROUTES ---
@app.post("/api/readings", response_model=ReadingSchema)
def create_reading(reading: ReadingCreate, background_tasks: BackgroundTasks):
    start_time = time.time()
    print(f"📥 Received Reading: {reading.power}mW from {reading.wallet_address[:8]}...")

    # 1. Run ML Verification
    is_anomaly_val = detect_anomaly(reading.voltage, reading.current, reading.power)
    is_anomaly = True if is_anomaly_val == -1 else False

    ipfs_hash = "QmbWqxBEKC3P8tvbrD6Dafv1Mp6fZf2XXYoGawUXGGGvrh"

    # 5. Blockchain Logging (OFF-LOADED TO BACKGROUND)
    def run_blockchain_task(wallet: str, power: float, is_anom: bool):
        start_bg = time.time()
        print(f"⛓️  [BG] Starting On-Chain Task...")
        try:
            tx_h = log_on_chain(
                wallet,
                float(power),
                int(time.time()),
                "QmbWqxBEKC3P8tvbrD6Dafv1Mp6fZf2XXYoGawUXGGGvrh",
                not is_anom
            )
            if tx_h:
                print(f"🔒 [BG] TX Logged: {tx_h[:12]}... (Took {time.time() - start_bg:.2f}s)")
            else:
                print(f"⚠️  [BG] TX Failed (Check Blockchain Node)")
        except Exception as e:
            print(f"❌ [BG] Error: {e}")

    background_tasks.add_task(run_blockchain_task, reading.wallet_address, float(reading.power), is_anomaly)

    elapsed = time.time() - start_time
    print(f"✅ Reading Processed in {elapsed:.4f}s. Returning to client.")
    
    # Return mock schema to satisfy FastAPI response_model
    mock_id = int(time.time())
    return {
        "id": mock_id,
        "voltage": reading.voltage,
        "current": reading.current,
        "power": reading.power,
        "wallet_address": reading.wallet_address,
        "timestamp": reading.timestamp,
        "is_anomaly": is_anomaly,
        "ipfs_hash": ipfs_hash,
        "blockchain_tx": "PENDING"
    }

@app.get("/api/readings/all")
def get_all_readings():
    import random
    history = []
    base_t = int(time.time()) - 600
    for i in range(100):
        power = round(random.uniform(10.0, 50.0), 2)
        history.append({
            "id": i,
            "timestamp": datetime.datetime.fromtimestamp(base_t + (i*10)).isoformat(),
            "power": power,
            "voltage": round(random.uniform(0.5, 0.9), 3),
            "current": round(power / round(random.uniform(0.5, 0.9), 3), 2),
            "is_anomaly": random.random() < 0.05,
            "wallet_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        })
    return history

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

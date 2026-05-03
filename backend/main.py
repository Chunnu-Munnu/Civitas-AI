from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from typing import List, Optional
import time
import datetime
import httpx

from web3 import Web3
import json
import os

from database import engine, SessionLocal, Base, User, Reading, get_db
from schemas import UserCreate, ReadingCreate, UserSchema, ReadingSchema
from ml_model import detect_anomaly

# ── ENV ──────────────────────────────────────────────────────────────
from dotenv import load_dotenv
env_loaded = load_dotenv()
print(f"📁 .env file loaded: {env_loaded}")

# ── LOCATION (Open-Meteo uses these) ────────────────────────────────
# Change to your actual location
LATITUDE  = 13.08   # Chennai default
LONGITUDE = 80.27

# ── Web3 / Blockchain ────────────────────────────────────────────────
RPC_URL = "http://127.0.0.1:8545"
w3 = Web3(Web3.HTTPProvider(RPC_URL))

PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY")
if not PRIVATE_KEY:
    print("⚠️  WARNING: ADMIN_PRIVATE_KEY not found in .env! Blockchain logging disabled.")
    PRIVATE_KEY = "0x" + "0" * 64

ACCOUNT_ADDRESS = None
if PRIVATE_KEY != ("0x" + "0" * 64):
    try:
        ACCOUNT_ADDRESS = w3.eth.account.from_key(PRIVATE_KEY).address
        print(f"🔗 Blockchain Admin: {ACCOUNT_ADDRESS}")
    except Exception as e:
        print(f"❌ Error loading PRIVATE_KEY: {e}")

try:
    with open("../Blockchain/deployedAddress.json") as f:
        CONTRACTS = json.load(f)
except Exception:
    CONTRACTS = {}
    print("⚠️  deployedAddress.json not found — blockchain logging will be skipped")

VERIFICATION_ABI = [
    {"inputs":[{"internalType":"address","name":"household","type":"address"},
               {"internalType":"uint256","name":"kwh","type":"uint256"},
               {"internalType":"uint256","name":"timestamp","type":"uint256"},
               {"internalType":"string","name":"ipfsHash","type":"string"},
               {"internalType":"bool","name":"isValid","type":"bool"}],
     "name":"storeVerification","outputs":[],"stateMutability":"nonpayable","type":"function"}
]

def log_on_chain(household: str, kwh: float, timestamp: int, ipfs_hash: str, is_valid: bool):
    if not CONTRACTS.get("SolarVerification") or not ACCOUNT_ADDRESS:
        return None
    try:
        contract = w3.eth.contract(address=CONTRACTS["SolarVerification"], abi=VERIFICATION_ABI)
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
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        return w3.to_hex(tx_hash)
    except Exception as e:
        print(f"⛓️  On-Chain Logging Failed: {e}")
        return None

# ── Open-Meteo Weather ───────────────────────────────────────────────
_weather_cache = {"data": None, "fetched_at": 0}

async def get_weather() -> dict:
    """Fetch current weather from Open-Meteo (free, no key needed). Cached 5 min."""
    now = time.time()
    if _weather_cache["data"] and now - _weather_cache["fetched_at"] < 300:
        return _weather_cache["data"]

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={LATITUDE}&longitude={LONGITUDE}"
        f"&current=cloud_cover,direct_radiation,weather_code"
        f"&timezone=Asia%2FKolkata"
    )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(url)
            raw = r.json()
        current = raw.get("current", {})
        data = {
            "cloud_cover":       current.get("cloud_cover", 50),        # %
            "direct_radiation":  current.get("direct_radiation", 0),    # W/m²
            "weather_code":      current.get("weather_code", 0),
            "ok": True
        }
    except Exception as e:
        print(f"🌦️  Open-Meteo error: {e}")
        data = {"cloud_cover": 50, "direct_radiation": 0, "weather_code": 0, "ok": False}

    _weather_cache["data"] = data
    _weather_cache["fetched_at"] = now
    return data

def weather_anomaly_check(voltage: float, power: float, weather: dict) -> tuple[bool, Optional[str]]:
    """
    Cross-check solar reading against live weather.
    Returns (is_suspicious, reason).
    """
    hour = datetime.datetime.now().hour
    radiation = weather.get("direct_radiation", 0)
    cloud_cover = weather.get("cloud_cover", 50)

    # Night check: 8pm – 5am
    if hour >= 20 or hour < 5:
        if power > 0.0001:   # >100µW at night is suspicious
            return True, f"Weather: solar generation at night ({hour:02d}:xx) — power={power*1e6:.0f}µW"

    # Heavy cloud check
    if cloud_cover > 90 and radiation < 10:
        if power > 0.001:    # >1mW under 0 radiation is suspicious
            return True, f"Weather: high power ({power*1e6:.0f}µW) under heavy cloud ({cloud_cover}%, radiation={radiation}W/m²)"

    return False, None

# ── LIVE STATE ───────────────────────────────────────────────────────
LIVE_STATE = {
    "metrics": {
        "power":      0.0,
        "voltage":    0.0,
        "current":    0.0,
        "dailyYield": 0.0,
        "balance":    15.50,
    },
    "history":          [],   # [{t, power, voltage, is_anomaly}]
    "recent_anomalies": [],   # [{t, power, reason}]
    "latest_tx":        "None",
    "weather":          {},
}

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CIVITAS AI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HEALTH ───────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"status": "CIVITAS Backend Online", "timestamp": time.time()}

# ── USER ─────────────────────────────────────────────────────────────
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

# ── DASHBOARD (with weather — slightly slower) ───────────────────────
@app.get("/api/dashboard/{wallet_address}")
async def get_dashboard(wallet_address: str):
    weather = await get_weather()
    LIVE_STATE["weather"] = weather
    return {
        "metrics":          LIVE_STATE["metrics"],
        "is_active":        True,
        "history":          LIVE_STATE["history"][-60:],
        "recent_anomalies": LIVE_STATE["recent_anomalies"][-10:],
        "weather":          weather,
        "latest_tx":        LIVE_STATE["latest_tx"],
    }

# ── FAST LIVE ENDPOINT (no weather fetch, instant) ───────────────────
@app.get("/api/live")
def get_live():
    """Zero-latency endpoint — just dumps LIVE_STATE. No async, no DB, no weather API."""
    return {
        "metrics":          LIVE_STATE["metrics"],
        "history":          LIVE_STATE["history"][-60:],
        "recent_anomalies": LIVE_STATE["recent_anomalies"][-10:],
        "weather":          LIVE_STATE.get("weather", {}),
        "latest_tx":        LIVE_STATE["latest_tx"],
    }

# ── WEATHER (standalone) ─────────────────────────────────────────────
@app.get("/api/weather")
async def weather_endpoint():
    return await get_weather()

# ── READINGS ─────────────────────────────────────────────────────────
@app.post("/api/readings", response_model=ReadingSchema)
async def create_reading(reading: ReadingCreate, background_tasks: BackgroundTasks):
    start_time = time.time()
    uA = reading.current * 1_000_000
    uW = reading.power   * 1_000_000
    i_str = f"{uA/1000:.2f}mA" if uA >= 1000 else f"{uA:.1f}µA"
    p_str = f"{uW/1000:.3f}mW" if uW >= 1000 else f"{uW:.1f}µW"
    print(f"📥 Reading: {reading.voltage:.3f}V | {i_str} | {p_str}")

    # ── Layer 1: ML + Physics ────────────────────────────────────────
    ml_label, ml_reason = detect_anomaly(reading.voltage, reading.current, reading.power)
    is_anomaly = (ml_label == -1)
    anomaly_reason = ml_reason or ""

    # ── Layer 2: Weather cross-validation ────────────────────────────
    weather = await get_weather()
    if not is_anomaly:
        w_suspicious, w_reason = weather_anomaly_check(reading.voltage, reading.power, weather)
        if w_suspicious:
            is_anomaly = True
            anomaly_reason = w_reason

    # ── Update LIVE STATE ────────────────────────────────────────────
    LIVE_STATE["metrics"]["power"]   = reading.power
    LIVE_STATE["metrics"]["voltage"] = reading.voltage
    LIVE_STATE["metrics"]["current"] = (
        reading.power / reading.voltage if reading.voltage > 0 else 0
    )
    LIVE_STATE["metrics"]["dailyYield"] += reading.power * (1 / 3600)  # Wh accumulator

    # GreenCoin reward — visible minting!
    # Every verified reading earns coins. Fraudulent readings COST coins.
    coin_delta = 0.0
    if not is_anomaly:
        # Base reward: 0.01 GRN per verified reading
        # Bonus: more power = more coins (scaled by µW)
        power_uW = reading.power * 1_000_000
        coin_delta = 0.01 + (power_uW * 0.00001)   # 0.01 base + tiny power bonus
    else:
        coin_delta = -0.5   # penalty for fraud
    
    LIVE_STATE["metrics"]["balance"] = round(LIVE_STATE["metrics"]["balance"] + coin_delta, 4)

    LIVE_STATE["history"].append({
        "t":          int(time.time()),
        "power":      reading.power,
        "voltage":    reading.voltage,
        "is_anomaly": is_anomaly,
    })
    if len(LIVE_STATE["history"]) > 500:
        LIVE_STATE["history"] = LIVE_STATE["history"][-500:]

    if is_anomaly:
        LIVE_STATE["recent_anomalies"].append({
            "t":      datetime.datetime.utcnow().isoformat(),
            "power":  reading.power,
            "voltage": reading.voltage,
            "reason": anomaly_reason,
        })
        if len(LIVE_STATE["recent_anomalies"]) > 50:
            LIVE_STATE["recent_anomalies"] = LIVE_STATE["recent_anomalies"][-50:]

    flag = "🚩 FRAUD" if is_anomaly else "✅ OK"
    print(f"{flag} | Reason: {anomaly_reason or 'clean'} | {(time.time()-start_time)*1000:.0f}ms")

    # ── Layer 3: Blockchain (background) ─────────────────────────────
    ipfs_hash = "QmbWqxBEKC3P8tvbrD6Dafv1Mp6fZf2XXYoGawUXGGGvrh"

    def _blockchain_task(wallet, power, is_anom):
        tx_h = log_on_chain(wallet, float(power), int(time.time()), ipfs_hash, not is_anom)
        if tx_h:
            LIVE_STATE["latest_tx"] = tx_h
            print(f"⛓️  TX: {tx_h[:14]}...")

    background_tasks.add_task(_blockchain_task, reading.wallet_address, reading.power, is_anomaly)

    return {
        "id":            int(time.time()),
        "voltage":       reading.voltage,
        "current":       reading.current,
        "power":         reading.power,
        "wallet_address": reading.wallet_address,
        "timestamp":     reading.timestamp,
        "is_anomaly":    is_anomaly,
        "reason":        anomaly_reason,
        "coin_delta":    round(coin_delta, 4),
        "balance":       LIVE_STATE["metrics"]["balance"],
        "ipfs_hash":     ipfs_hash,
        "blockchain_tx": "PENDING",
    }

# ── HISTORY ──────────────────────────────────────────────────────────
@app.get("/api/readings/all")
def get_all_readings():
    result = []
    for i, item in enumerate(LIVE_STATE["history"][-100:]):
        result.append({
            "id":             i,
            "timestamp":      datetime.datetime.fromtimestamp(item["t"]).isoformat(),
            "power":          item["power"],
            "voltage":        item["voltage"],
            "current":        item["power"] / item["voltage"] if item["voltage"] > 0 else 0,
            "is_anomaly":     item["is_anomaly"],
            "wallet_address": "0xHardware",
            "blockchain_tx":  LIVE_STATE["latest_tx"],
        })
    return result

# ── ADMIN ────────────────────────────────────────────────────────────
@app.get("/api/admin/users", response_model=List[UserSchema])
def get_admin_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.get("/api/admin/anomalies")
def get_admin_anomalies():
    return LIVE_STATE["recent_anomalies"]

@app.get("/api/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.green_coins.desc()).limit(10).all()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

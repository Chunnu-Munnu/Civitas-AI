"""
CIVITAS AI - Backend Verification Engine
FastAPI + Isolation Forest ML + OpenMeteo Weather API + SQLite

Run: uvicorn main:app --reload --port 8000
"""

import asyncio
import sqlite3
import json
import time
from datetime import datetime, timezone
from collections import deque
from contextlib import asynccontextmanager
from typing import Optional

import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
LATITUDE  = 13.0827   # Change to your location (Chennai default)
LONGITUDE = 80.2707
DB_PATH   = "civitas.db"
BUFFER_SIZE = 200      # readings kept in RAM for ML training

# ─────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────
data_buffer: deque = deque(maxlen=BUFFER_SIZE)
ml_model: Optional[IsolationForest] = None
latest_reading: dict = {}
coins_balance: float = 50.0   # start with 50 demo coins
weather_cache: dict = {"data": None, "ts": 0}

# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS energy_logs (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            voltage   REAL,
            current   REAL,
            power     REAL,
            status    TEXT,
            anomaly_reason TEXT,
            coins_delta REAL,
            weather_irradiance REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id    INTEGER PRIMARY KEY,
            name  TEXT,
            phone TEXT,
            coins REAL DEFAULT 50.0
        )
    """)
    conn.commit()
    conn.close()

def log_to_db(voltage, current, power, status, reason, delta, irradiance):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO energy_logs
        (timestamp, voltage, current, power, status, anomaly_reason, coins_delta, weather_irradiance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        voltage, current, power, status, reason, delta, irradiance
    ))
    conn.commit()
    conn.close()

def get_history(limit=100):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM energy_logs ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

# ─────────────────────────────────────────────
# OPEN-METEO WEATHER
# ─────────────────────────────────────────────
async def fetch_weather() -> dict:
    """Fetch solar irradiance + cloud cover from Open-Meteo. Caches 5 min."""
    global weather_cache
    now = time.time()
    if weather_cache["data"] and now - weather_cache["ts"] < 300:
        return weather_cache["data"]

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={LATITUDE}&longitude={LONGITUDE}"
        f"&current=cloud_cover,sunshine_duration,shortwave_radiation"
        f"&hourly=shortwave_radiation"
        f"&timezone=auto&forecast_days=1"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
        current = data.get("current", {})
        result = {
            "cloud_cover":          current.get("cloud_cover", 50),
            "sunshine_duration":    current.get("sunshine_duration", 0),
            "shortwave_radiation":  current.get("shortwave_radiation", 0),
            "source": "open-meteo",
            "ok": True
        }
    except Exception as e:
        result = {
            "cloud_cover": 50,
            "sunshine_duration": 0,
            "shortwave_radiation": 100,
            "source": "fallback",
            "ok": False,
            "error": str(e)
        }

    weather_cache = {"data": result, "ts": now}
    return result

# ─────────────────────────────────────────────
# ML MODEL
# ─────────────────────────────────────────────
def train_model():
    global ml_model
    if len(data_buffer) < 20:
        return   # not enough data yet
    X = np.array([[r["voltage"], r["current"], r["power"]] for r in data_buffer])
    ml_model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    ml_model.fit(X)

def ml_predict(voltage, current, power) -> tuple[bool, float]:
    """Returns (is_anomaly, score). Score < 0 = more anomalous."""
    global ml_model
    if ml_model is None:
        return False, 0.0
    X = np.array([[voltage, current, power]])
    pred  = ml_model.predict(X)[0]   # 1=normal, -1=anomaly
    score = ml_model.score_samples(X)[0]
    return pred == -1, float(score)

# ─────────────────────────────────────────────
# VERIFICATION ENGINE
# ─────────────────────────────────────────────
def physics_check(voltage, current, power) -> tuple[bool, str]:
    """Returns (ok, reason_if_fail)"""
    if not (0.0 <= voltage <= 6.5):
        return False, f"Voltage out of range: {voltage:.2f}V (expected 0–6.5V)"
    if current < 0:
        return False, f"Negative current: {current:.4f}A"
    if power < 0:
        return False, f"Negative power: {power:.4f}W"
    if voltage > 0.1 and current > 0 and abs(power - voltage * current) > 0.5:
        return False, f"P≠V×I mismatch: P={power:.3f} vs V×I={voltage*current:.3f}"
    return True, ""

def weather_check(power, weather: dict) -> tuple[bool, str]:
    irradiance = weather.get("shortwave_radiation", 100)
    cloud      = weather.get("cloud_cover", 50)

    # Night/heavy cloud with significant power → suspicious
    if irradiance < 5 and power > 0.05:
        return False, f"Power detected ({power:.3f}W) but solar irradiance is {irradiance:.1f} W/m² (night/cloud)"

    # Very high cloud cover with unrealistically high power
    if cloud > 90 and power > 0.5:
        return False, f"High power ({power:.3f}W) under {cloud}% cloud cover"

    return True, ""

async def verify(voltage: float, current: float, power: float) -> dict:
    global coins_balance

    reasons = []

    # 1. Physics
    phys_ok, phys_reason = physics_check(voltage, current, power)
    if not phys_ok:
        reasons.append(f"Physics: {phys_reason}")

    # 2. Weather
    weather = await fetch_weather()
    wx_ok, wx_reason = weather_check(power, weather)
    if not wx_ok:
        reasons.append(f"Weather: {wx_reason}")

    # 3. ML
    ml_anom, ml_score = ml_predict(voltage, current, power)
    if ml_anom:
        reasons.append(f"ML anomaly score: {ml_score:.3f}")

    is_anomaly = len(reasons) > 0
    status = "ANOMALY" if is_anomaly else "GREEN"

    # Coins
    if not is_anomaly:
        delta = round(power * 0.01, 4)
    else:
        delta = -1.0
    coins_balance = round(coins_balance + delta, 4)

    # Log
    log_to_db(voltage, current, power, status, "; ".join(reasons), delta,
              weather.get("shortwave_radiation", 0))

    return {
        "status":        status,
        "reasons":       reasons,
        "ml_score":      ml_score,
        "coins_delta":   delta,
        "coins_balance": coins_balance,
        "weather":       weather,
        "timestamp":     datetime.now(timezone.utc).isoformat(),
    }

# ─────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Background model retraining
    async def retrain_loop():
        while True:
            await asyncio.sleep(30)
            train_model()
    asyncio.create_task(retrain_loop())
    yield

app = FastAPI(title="Civitas AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───
class Reading(BaseModel):
    voltage: float
    current: float
    power:   float

class UserCreate(BaseModel):
    name:  str
    phone: str

# ─── Routes ───
@app.post("/ingest")
async def ingest(reading: Reading):
    """Receive sensor data, run verification, return result."""
    global latest_reading

    result = await verify(reading.voltage, reading.current, reading.power)

    # Buffer for ML
    data_buffer.append({
        "voltage": reading.voltage,
        "current": reading.current,
        "power":   reading.power,
    })

    latest_reading = {
        "voltage":       reading.voltage,
        "current":       reading.current,
        "power":         reading.power,
        **result
    }
    return latest_reading

@app.get("/data")
async def get_latest():
    """Latest reading + status for frontend polling."""
    if not latest_reading:
        # Return demo data if nothing ingested yet
        weather = await fetch_weather()
        return {
            "voltage": 0.0,
            "current": 0.0,
            "power":   0.0,
            "status":  "IDLE",
            "reasons": [],
            "coins_balance": coins_balance,
            "weather": weather,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    return latest_reading

@app.get("/history")
async def history(limit: int = 60):
    return get_history(limit)

@app.get("/weather")
async def weather_endpoint():
    return await fetch_weather()

@app.get("/coins")
async def coins():
    return {"coins": coins_balance}

@app.post("/users")
async def create_user(user: UserCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "INSERT INTO users (name, phone, coins) VALUES (?, ?, 50.0)",
        (user.name, user.phone)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": user_id, "name": user.name, "phone": user.phone, "coins": 50.0}

@app.get("/health")
async def health():
    return {"ok": True, "buffer_size": len(data_buffer), "model_trained": ml_model is not None}

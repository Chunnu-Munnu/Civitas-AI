import requests
import json
import time
import random

# CIVITAS Hardware Emulator
# Use this to test the Real-Time Blockchain & ML Pipeline without an ESP32
API_URL = "http://localhost:8000/api/readings"
WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

print("🚀 CIVITAS Hardware Emulator Starting...")
print(f"Target: {API_URL}")
print("Mode: REAL-TIME BLOCKCHAIN LOGGING\n")

while True:
    # Simulate realistic solar fluctuations
    v = round(0.5 + random.uniform(0, 0.4), 3)
    c = round(20 + random.uniform(0, 30), 1)
    p = round(v * c, 2)
    
    # 5% chance to simulate a fake grid injection (anomaly)
    if random.random() < 0.05:
        v = 24.5
        p = 500.0
        print("🚩 SIMULATING ANOMALY (24V Injection)")

    payload = {
        "wallet_address": WALLET,
        "voltage": v,
        "current": c,
        "power": p,
        "timestamp": time.time()
    }

    print(f"📡 Attempting to send reading: {v}V, {p}mW...", end="\r")

    try:
        res = requests.post(API_URL, json=payload, timeout=5)
        if res.status_code != 200:
            print(f"\n❌ Server Error {res.status_code}: {res.text}")
            continue
            
        data = res.json()
        status = "✅ Verified" if not data.get("is_anomaly") else "🚩 ANOMALY"
        tx = data.get("tx_hash") or "PENDING"
        print(f"\n{status} | P: {p}mW | TX: {tx[:12]}...")
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")

    time.sleep(3) 

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
    # 1. Simulate realistic solar fluctuations
    # Voltage: 0.5V to 0.9V (Low voltage solar cell)
    v = round(0.5 + random.uniform(0, 0.4), 3)
    # Current: 20mA to 50mA (0.020A to 0.050A)
    c_amps = round(0.02 + random.uniform(0, 0.03), 3)
    # Power in Watts
    p_watts = round(v * c_amps, 5)
    
    # 5% chance to simulate a fake grid injection (anomaly)
    is_anomaly_fake = False
    if random.random() < 0.05:
        v = 24.5
        p_watts = 0.5 # 500mW
        is_anomaly_fake = True
        print("\n🚩 SIMULATING ANOMALY (24V Injection detected)")

    payload = {
        "wallet_address": WALLET,
        "voltage": v,
        "current": c_amps,
        "power": p_watts,
        "timestamp": time.time()
    }

    print(f"📡 Sending: {v}V | {c_amps*1000:.1f}mA | {p_watts*1000:.2f}mW...", end="\r")

    try:
        # Increased timeout to 30s as backend might be busy with blockchain
        res = requests.post(API_URL, json=payload, timeout=30)
        if res.status_code != 200:
            print(f"\n❌ Server Error {res.status_code}: {res.text}")
        else:
            data = res.json()
            status = "✅ Verified" if not data.get("is_anomaly") else "🚩 ANOMALY"
            tx = status if not data.get("is_anomaly") else "BLOCKED"
            print(f"\n{status} | Power: {p_watts*1000:.2f}mW | On-Chain: PENDING (Background)")
            
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")

    time.sleep(3) 

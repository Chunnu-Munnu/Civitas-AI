"""
CIVITAS Hardware Emulator
Mimics ESP32 + INA219 + Solar Panel output.
Sends realistic solar readings to the backend, with a 5% chance of a fake-grid anomaly.
"""
import requests
import time
import random

API_URL = "http://localhost:8000/api/readings"
WALLET  = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

print("🚀 CIVITAS Hardware Emulator Starting...")
print(f"   Target : {API_URL}")
print(f"   Wallet : {WALLET[:12]}...\n")

while True:
    # Simulate realistic small solar cell output
    # Voltage: 0.3 – 1.2 V (single cell under partial to full sun)
    v = round(0.3 + random.uniform(0, 0.9), 3)
    # Current: 10 – 60 mA
    c_amps = round(0.010 + random.uniform(0, 0.050), 4)
    p_watts = round(v * c_amps, 5)

    label = "☀️  Normal"

    # 5% chance → fake grid injection (e.g. connecting a 24V supply)
    if random.random() < 0.05:
        v       = round(24.0 + random.uniform(0, 2), 2)
        c_amps  = round(0.020 + random.uniform(0, 0.01), 4)
        p_watts = round(v * c_amps, 5)
        label   = "🚩 FAKE GRID"

    payload = {
        "wallet_address": WALLET,
        "voltage":        v,
        "current":        c_amps,
        "power":          p_watts,
        "timestamp":      time.time(),
    }

    print(f"{label} | {v:.3f}V | {c_amps*1000:.1f}mA | {p_watts*1000:.2f}mW  ", end="")

    try:
        res = requests.post(API_URL, json=payload, timeout=10)
        if res.status_code == 200:
            data = res.json()
            if data.get("is_anomaly"):
                print(f"→ 🚩 BACKEND FLAGGED")
            else:
                print(f"→ ✅ Verified")
        else:
            print(f"→ ❌ HTTP {res.status_code}")
    except Exception as e:
        print(f"→ ❌ {e}")

    time.sleep(2)

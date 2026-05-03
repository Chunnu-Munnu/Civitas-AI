"""
CIVITAS AI - Hardware Emulator
Simulates ESP32 + solar panel data with occasional fraud attempts.
Run this instead of serial_reader.py when no hardware is connected.
"""

import requests
import time
import random
import math
import sys
from datetime import datetime

API_URL = "http://127.0.0.1:8000/ingest"

def solar_irradiance_factor():
    """Returns 0–1 based on simulated time of day."""
    hour = datetime.now().hour + datetime.now().minute / 60
    if hour < 6 or hour > 19:
        return 0.0
    peak = 13.0
    return max(0, math.cos((hour - peak) * math.pi / 13))

def generate_normal():
    factor = solar_irradiance_factor()
    noise  = random.gauss(0, 0.05)
    voltage = max(0, 4.5 * factor + noise)
    current = max(0, 0.8 * factor + random.gauss(0, 0.02))
    power   = voltage * current
    return voltage, current, power

def generate_fraud(fraud_type: int):
    if fraud_type == 0:
        # Voltage spike (meter manipulation)
        return 5.8 + random.uniform(0, 0.5), 1.5, 9.5
    elif fraud_type == 1:
        # Power with no sun (night injection)
        return 4.2, 0.9, 3.8
    else:
        # P ≠ V × I mismatch
        return 4.0, 0.5, 8.0

def send(voltage, current, power, label=""):
    data = {"voltage": round(voltage, 4), "current": round(current, 4), "power": round(power, 4)}
    try:
        resp = requests.post(API_URL, json=data, timeout=5)
        r    = resp.json()
        status = r.get("status", "?")
        sym = "✅" if status == "GREEN" else "⚠️ ANOMALY"
        tag = f"[{label}]" if label else ""
        print(f"{sym} {tag} V={voltage:.2f}V I={current*1000:.0f}mA P={power*1000:.0f}mW  Coins:{r.get('coins_balance','?')}")
        if r.get("reasons"):
            for reason in r["reasons"]:
                print(f"        ↳ {reason}")
    except Exception as e:
        print(f"❌ {e} — is backend running?")

def main():
    print("🛰️  CIVITAS AI Emulator started (Ctrl+C to stop)")
    print("   Sending normal readings every 1s, fraud every ~15s\n")
    cycle = 0
    while True:
        cycle += 1
        # Every ~15 readings inject fraud
        if cycle % 15 == 0:
            fraud_type = random.randint(0, 2)
            labels = ["Voltage Spike", "Night Injection", "V×I Mismatch"]
            v, i, p = generate_fraud(fraud_type)
            send(v, i, p, label=f"FRAUD:{labels[fraud_type]}")
        else:
            v, i, p = generate_normal()
            send(v, i, p)
        time.sleep(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 Emulator stopped.")
        sys.exit(0)

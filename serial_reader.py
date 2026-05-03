"""
CIVITAS AI - Serial Reader
Reads ESP32 CSV data from serial port → sends to backend API

Usage: python serial_reader.py
Change COM_PORT to your ESP32 port (e.g., COM3, /dev/ttyUSB0, /dev/ttyACM0)
"""

import serial
import requests
import time
import sys

# ─── CONFIG ───────────────────────────────────
COM_PORT    = "COM3"          # ← CHANGE THIS
BAUD_RATE   = 115200
API_URL     = "http://127.0.0.1:8000/ingest"
RETRY_DELAY = 3
# ──────────────────────────────────────────────

def parse_line(line: str):
    """Parse 'voltage,current,power' CSV line."""
    parts = line.strip().split(",")
    if len(parts) != 3:
        return None
    try:
        return {
            "voltage": float(parts[0]),
            "current": float(parts[1]),
            "power":   float(parts[2]),
        }
    except ValueError:
        return None

def send_to_api(data: dict):
    try:
        resp = requests.post(API_URL, json=data, timeout=5)
        result = resp.json()
        status = result.get("status", "?")
        coins  = result.get("coins_balance", "?")
        symbol = "✅" if status == "GREEN" else "⚠️"
        print(f"{symbol} V={data['voltage']:.2f}V  "
              f"I={data['current']*1000:.1f}mA  "
              f"P={data['power']*1000:.1f}mW  "
              f"→ {status}  Coins:{coins}")
        if result.get("reasons"):
            for r in result["reasons"]:
                print(f"   ↳ {r}")
    except requests.exceptions.ConnectionError:
        print("⚠️  Backend not reachable. Is main.py running?")
    except Exception as e:
        print(f"❌ API error: {e}")

def main():
    print(f"🔌 Connecting to {COM_PORT} @ {BAUD_RATE} baud...")
    while True:
        try:
            with serial.Serial(COM_PORT, BAUD_RATE, timeout=2) as ser:
                print(f"✅ Connected to {COM_PORT}")
                while True:
                    raw = ser.readline().decode("utf-8", errors="ignore")
                    if not raw.strip():
                        continue
                    # Skip non-data lines
                    if "CIVITAS" in raw or "ERR" in raw:
                        print(f"[ESP32] {raw.strip()}")
                        continue
                    data = parse_line(raw)
                    if data:
                        send_to_api(data)
        except serial.SerialException as e:
            print(f"❌ Serial error: {e}")
            print(f"   Retrying in {RETRY_DELAY}s... (check COM_PORT)")
            time.sleep(RETRY_DELAY)
        except KeyboardInterrupt:
            print("\n👋 Stopped.")
            sys.exit(0)

if __name__ == "__main__":
    main()

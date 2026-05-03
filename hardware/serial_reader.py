"""
CIVITAS AI - Serial Reader v3 (FAST)
ESP32 sends: voltage(V), current(µA), power(µW)
Converts to SI units (V, A, W) and posts to backend.
"""
import serial
import requests
import time
import sys

SERIAL_PORT    = "COM7"
BAUD_RATE      = 115200
API_URL        = "http://localhost:8000/api/readings"
WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

BOOT_PREFIXES = (
    "rst:", "configsip", "clk_drv", "mode:", "load:", "ho ", "entry ",
    "ets ", "boot:", "SPI_FAST", "ld."
)

def is_boot_line(line):
    return any(line.startswith(p) for p in BOOT_PREFIXES)

def fmt_power(uW):
    if uW >= 1000:
        return f"{uW/1000:.3f}mW"
    return f"{uW:.1f}µW"

def fmt_current(uA):
    if uA >= 1000:
        return f"{uA/1000:.2f}mA"
    return f"{uA:.1f}µA"

# Reuse a single session for speed (no TCP handshake per request)
session = requests.Session()

def run_bridge():
    print(f"🚀 CIVITAS Bridge on {SERIAL_PORT}")

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        ser.reset_input_buffer()
        print("✅ Connected. Waiting for ESP32...\n")
    except Exception as e:
        print(f"❌ Cannot open {SERIAL_PORT}: {e}")
        return

    while True:
        try:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode('utf-8', errors='replace').strip()
            if not line:
                continue
            if is_boot_line(line):
                continue
            if "CIVITAS_AI_READY" in line:
                print("🟢 ESP32 Ready — streaming data...\n")
                continue
            if line.startswith("ERR:"):
                print(f"🔴 {line}")
                continue
            if "===" in line or "Found" in line or "Total" in line or "LCD" in line or "INA" in line:
                print(f"ℹ️  {line}")
                continue

            parts = line.split(',')
            if len(parts) == 3:
                try:
                    voltage_V  = float(parts[0])
                    current_uA = float(parts[1])
                    power_uW   = float(parts[2])
                except ValueError:
                    continue

                current_A = current_uA / 1_000_000.0
                power_W   = power_uW   / 1_000_000.0

                payload = {
                    "wallet_address": WALLET_ADDRESS,
                    "voltage":        round(voltage_V, 5),
                    "current":        round(current_A, 8),
                    "power":          round(power_W,   8),
                    "timestamp":      time.time(),
                }

                try:
                    res = session.post(API_URL, json=payload, timeout=3)
                    if res.status_code == 200:
                        d = res.json()
                        status = "🚩 FRAUD" if d.get("is_anomaly") else "✅ OK"
                        reason = d.get("reason", "")
                        print(f"{status} | {voltage_V:.3f}V | {fmt_current(current_uA)} | {fmt_power(power_uW)}"
                              + (f" | {reason}" if reason else ""))
                    else:
                        print(f"❌ HTTP {res.status_code}")
                except requests.exceptions.ConnectionError:
                    print("❌ Backend offline")

        except KeyboardInterrupt:
            print("\n👋 Stopped.")
            sys.exit(0)
        except Exception as e:
            print(f"⚠️ {e}")
            time.sleep(0.5)

if __name__ == "__main__":
    run_bridge()

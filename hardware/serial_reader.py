import serial
import requests
import json
import time

# --- CONFIGURATION ---
# Change this to your ESP32's COM port (e.g. "COM3", "COM7")
SERIAL_PORT = "COM7" 
BAUD_RATE = 115200
API_URL = "http://localhost:8000/api/readings"
WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

def run_bridge():
    print(f"🚀 Initializing CIVITAS Hardware Bridge on {SERIAL_PORT}...")
    
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2) # Wait for ESP32 to reboot
        print("✅ Connection Established. Listening for Solar Data...")
    except Exception as e:
        print(f"❌ SERIAL ERROR: Could not open {SERIAL_PORT}. Is the ESP32 plugged in?")
        print(f"Details: {e}")
        return

    while True:
        try:
            line = ser.readline().decode('utf-8').strip()
            if not line:
                continue
                
            print(f"📡 Raw Serial: {line}")
            
            # Expected format: "voltage,current,power"
            parts = line.split(',')
            if len(parts) == 3:
                v, c, p = parts
                data = {
                    "wallet_address": WALLET_ADDRESS,
                    "voltage": float(v),
                    "current": float(c),
                    "power": float(p),
                    "timestamp": time.time()
                }
                
                # POST to local FastAPI backend
                response = requests.post(API_URL, json=data)
                if response.status_code == 200:
                    res_data = response.json()
                    status = "✅ Verified" if not res_data.get('is_anomaly') else "🚩 FRAUD"
                    tx = res_data.get('tx_hash', 'PENDING')
                    print(f"{status} | P: {p}mW | TX: {tx[:10]}...")
                else:
                    print(f"❌ API Error: {response.status_code}")
            else:
                print("⚠️ Invalid format. Expected: 'voltage,current,power'")
                
        except Exception as e:
            print(f"⚠️ Bridge Error: {e}")
            time.sleep(1)

if __name__ == "__main__":
    run_bridge()

# 🛰️ CIVITAS AI — Decentralized Solar Verification & Rewards

> **VisionX Green Fintech Hackathon 2026**
> ESP32 + INA219 + 16×2 LCD → Python → FastAPI → Blockchain → React Dashboard

---

## What This System Does

| Layer | Component | Role |
|---|---|---|
| **Hardware** | ESP32 + INA219 + Solar Panel + LCD | Reads voltage/current/power, displays on LCD, sends CSV over serial |
| **Bridge** | `serial_reader.py` | Reads serial from COM7, POSTs to FastAPI |
| **AI Engine** | `backend/main.py` + `ml_model.py` | 3-layer fraud detection: Physics → Open-Meteo weather → Isolation Forest ML |
| **Blockchain** | Hardhat + Solidity | Immutable on-chain log of every verified reading |
| **Dashboard** | React (Vite + Tailwind) | Live charts, weather panel, anomaly log with reasons, GreenCoins |

---

## Hardware Wiring (ESP32 DevKit V1)

```
ESP32 3.3V ──┬── INA219 VCC
             └── LCD VCC (5V ok too)

ESP32 GND   ──┬── INA219 GND
              └── LCD GND

ESP32 D21   ──┬── INA219 SDA
              └── LCD SDA       (shared I2C bus)

ESP32 D22   ──┬── INA219 SCL
              └── LCD SCL       (shared I2C bus)

Solar (+)   ──── INA219 VIN+
INA219 VIN- ──── 1kΩ resistor ──── LED (+)
LED (-)     ──── Solar (-)
```

**LCD I2C address**: most modules = `0x27`. If LCD shows nothing, change to `0x3F` in line 27 of `civitas_esp32.ino`.

**Serial output** (115200 baud, every 1 second):
```
4.857,0.0032,0.0155
```
Format: `voltage(V),current(A),power(W)`

---

## One-Time Setup

### Prerequisites
- Node.js 18+
- Python 3.11
- Arduino IDE with these libraries installed:
  - `Adafruit INA219`
  - `LiquidCrystal I2C` (by Frank de Brabander)
  - `Wire` (built-in)

### 1. Flash the ESP32
1. Open `civitas_esp32.ino` in Arduino IDE
2. Select Board → **ESP32 Dev Module**
3. Select Port → **COM7**
4. Upload
5. Open Serial Monitor at **115200 baud** — you should see readings like `0.823,0.0041,0.0034`
6. LCD should show `CIVITAS AI / Solar Node` splash, then alternate between voltage/power and status screens

### 2. Install Python dependencies
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Install Blockchain dependencies
```powershell
cd Blockchain
npm install
```

### 4. Install Frontend dependencies
```powershell
cd frontend
npm install
```

---

## Running the System (4 Terminals in order)

### Terminal 1 — Local Blockchain Node
```powershell
cd Blockchain
npx hardhat node
```
> Leave this running. It prints 20 test accounts. Account #0 is the admin (already in `.env`).

---

### Terminal 2 — Deploy Contracts + Start Backend
**Step A — Deploy (only needed first time, or after `npx hardhat node` restarts):**
```powershell
cd Blockchain
npx hardhat run scripts/deploy-civitas.js --network localhost
```
> This updates `Blockchain/deployedAddress.json` automatically.

**Step B — Start FastAPI backend:**
```powershell
cd backend
.\venv\Scripts\activate
python main.py
```
> Wait for: `📁 .env file loaded: True` and `Uvicorn running on http://0.0.0.0:8000`

You can test it's working: open http://localhost:8000 in browser → should return JSON.

---

### Terminal 3 — React Dashboard
```powershell
cd frontend
npm run dev
```
> Visit **http://localhost:5174** (or whichever port Vite picks — check the terminal output)

Login with any name + wallet address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

---

### Terminal 4 — Data Source (choose ONE)

#### Option A: Real ESP32 on COM7
```powershell
cd hardware
python serial_reader.py
```
> COM port is already set to **COM7** in `hardware/serial_reader.py` line 8.
> You should see `✅ Verified` or `🚩 FRAUD` for each reading.

#### Option B: Software Emulator (no hardware needed)
```powershell
cd hardware
python hardware_emulator.py
```
> Simulates realistic solar readings with random 5% anomaly injections.

---

## How Anomaly Detection Works (3 Layers)

```
Reading arrives at POST /api/readings
         │
         ▼
┌─────────────────────────────┐
│  Layer 1: Physics Check     │  voltage > 6V? power > 5W? negatives?
│  (instant, no ML)           │  → FRAUD if yes
└─────────────┬───────────────┘
              │ pass
              ▼
┌─────────────────────────────┐
│  Layer 2: Open-Meteo        │  Is it night? Heavy clouds + high radiation mismatch?
│  Weather Cross-check        │  → FRAUD if solar impossible given weather
└─────────────┬───────────────┘
              │ pass
              ▼
┌─────────────────────────────┐
│  Layer 3: Isolation Forest  │  Statistical outlier in [voltage, current, power] space
│  (self-retrains every 30s)  │  → FRAUD if anomaly score threshold exceeded
└─────────────┬───────────────┘
              │
              ▼
        Result logged to:
        - LIVE_STATE (dashboard polls this)
        - Blockchain (background task)
```

Every anomaly shows its **reason** in the dashboard Anomaly Log — e.g.:
- `Physics: voltage 24.50V exceeds solar max (6.0V)`
- `Weather: solar generation at night (23:xx) — power=35.2mW`
- `ML Isolation Forest: anomaly score -0.312`

---

## Checking if Things Are Working

| Check | Expected |
|---|---|
| Serial Monitor (Arduino IDE) | `0.823,0.0041,0.0034` lines every 1 second |
| LCD Screen | Alternates between `V: 0.82V  I: 4.1mA` and `CIVITAS SOLAR / STATUS: ACTIVE` |
| http://localhost:8000 | `{"status":"CIVITAS Backend Online",...}` |
| http://localhost:8000/api/weather | JSON with `cloud_cover`, `direct_radiation` |
| Terminal 4 output | `☀️ Normal → ✅ Verified` or `🚩 FAKE GRID → 🚩 BACKEND FLAGGED` |
| Dashboard | Live voltage/power charts updating every 1.2 seconds |

---

## Common Issues & Fixes

| Problem | Fix |
|---|---|
| LCD shows nothing | Change `0x27` → `0x3F` in `civitas_esp32.ino` line 27 |
| `ERR:INA219_NOT_FOUND` in Serial | Check SDA/SCL wiring (D21/D22), check 3.3V power |
| `SERIAL ERROR: Could not open COM7` | Check Device Manager for correct COM port, update line 8 in `hardware/serial_reader.py` |
| Backend won't start — `ModuleNotFoundError` | Run `pip install -r requirements.txt` inside activated venv |
| Dashboard shows 0mW / no data | Make sure Terminal 4 (emulator or serial_reader) is running |
| Blockchain TX always fails | Restart Terminal 1 (`hardhat node`), re-run deploy in Terminal 2 |
| All readings flagged as anomaly | Your solar panel outputs > 6V — increase `VOLTAGE_MAX` in `backend/ml_model.py` line 27 |

---

## Key Files Reference

```
VISION-X_GREEN_FINTECH/
├── civitas_esp32.ino          ← Flash this to the ESP32
├── hardware/
│   ├── serial_reader.py       ← COM7 bridge → backend (real hardware)
│   └── hardware_emulator.py   ← Software demo (no hardware needed)
├── backend/
│   ├── main.py                ← FastAPI: 3-layer verification + Open-Meteo
│   ├── ml_model.py            ← Isolation Forest (self-retraining)
│   ├── database.py            ← SQLite models
│   ├── schemas.py             ← Pydantic models
│   ├── requirements.txt       ← Python dependencies
│   └── .env                   ← Hardhat admin private key (already filled)
├── frontend/
│   └── src/pages/
│       ├── Dashboard.jsx      ← Live charts + weather + anomaly log
│       ├── Analytics.jsx      ← Historical charts
│       ├── Rewards.jsx        ← GreenCoins
│       ├── BlockchainVerification.jsx
│       └── AdminPortal.jsx
└── Blockchain/
    ├── contracts/
    │   ├── GreenCoin.sol
    │   ├── SolarVerification.sol
    │   └── SubsidyRegistry.sol
    ├── scripts/deploy-civitas.js
    └── deployedAddress.json   ← Auto-updated on deploy
```

---

## Team

**Team VisionX** · Green Fintech Hackathon 2026
Repo: https://github.com/Chunnu-Munnu/Civitas-AI

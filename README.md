# 🛰️ CIVITAS AI - Decentralized Solar Verification & Rewards

**Civitas AI** is a complete Web3 + AI solution designed for the **VisionX Green Fintech Hackathon**. It ensures solar generation data is 100% transparent and fraud-proof by combining IoT hardware (ESP32), Machine Learning (Isolation Forest), and Blockchain (Smart Contracts).

---

## 📖 What it Does
1.  **Hardware Ingest**: An ESP23 with an INA219 sensor measures real-time Solar Voltage and Current.
2.  **AI Verification**: Every reading is passed through an **Isolation Forest** ML model in the backend to ensure it's not a fraudulent "fake" injection.
3.  **Blockchain Logging**: Verified data is signed and logged on a private Polygon (Hardhat) network.
4.  **Incentive Layer**: Users earn **GreenCoins (GRN)** for their production, which can be redeemed for grid discounts or carbon certificates.

---

## 🛠️ Step-by-Step Setup Guide

### 📋 1. Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Hardhat** (for local blockchain)

### ⛓️ 2. Start the Blockchain (Node)
In a new terminal:
```bash
cd Blockchain
yarn install
npx hardhat node
```
*Note: This generates 20 test accounts. We will use the first one (Account #0) as our Admin.*

### ⚙️ 3. Deploy Contract & Start API (Backend)
In a second terminal:
```bash
# Deploys the verification contract
cd Blockchain
npx hardhat run scripts/deploy-civitas.js --network localhost

# Start the Python API
cd ../backend
python -m venv venv
./venv/Scripts/activate  # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 💻 4. Launch the Portal (Frontend)
In a third terminal:
```bash
cd frontend
npm install
npm run dev
```
*Visit: [http://localhost:5174](http://localhost:5174)*

### 📡 5. Feed the Data (Hardware / Emulator)
In a fourth terminal:

**Option A (With Hardware):**
Plug in your ESP32. Check your COM port in Device Manager.
Change `SERIAL_PORT` in `hardware/serial_reader.py` to your port (e.g., `COM3`).
```bash
cd hardware
python serial_reader.py
```

**Option B (Emulator - No Hardware needed):**
```bash
cd hardware
python hardware_emulator.py
```

---

## 🛡️ Admin & Audit Features
- **Live Fraud Feed**: Go to the **Admin Portal** to see blocked anomalies in real-time.
- **Export Audit**: Every transaction can be exported as a CSV file for government subsidies.
- **On-Chain Trust**: Verify any reading by its Transaction Hash on the **Blockchain** page.

---

## 👨‍💻 Submission Details
- **Team**: VisionX
- **Repo**: [https://github.com/Chunnu-Munnu/Civitas-AI](https://github.com/Chunnu-Munnu/Civitas-AI)
- **Status**: Production Ready for Hackathon Demo.

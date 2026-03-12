# 🛰️ CIVITAS AI - Decentralized Solar Verification & Rewards

**Civitas AI** is a complete Web3 + AI solution designed for the **VisionX Green Fintech Hackathon**. It ensures solar generation data is 100% transparent and fraud-proof by combining IoT hardware (ESP32), Machine Learning (Isolation Forest), and Blockchain (Smart Contracts).

---

## 🛠️ Installation Guide (First-Time Setup)

### 📋 1. Prerequisites
- **Node.js**: v18 or later
- **Python**: **v3.11** (recommended for ML stability)
- **Hardhat**: Global or local (included in dev dependencies)

### 📥 2. Initial Setup
```bash
# Clone the repository
git clone https://github.com/Chunnu-Munnu/Civitas-AI.git
cd Civitas-AI

# Install Blockchain dependencies
cd Blockchain
npm install

# Install Frontend dependencies
cd ../frontend
npm install

# Setup Python Environment
cd ../backend
python -m venv venv
./venv/Scripts/activate  # Windows
pip install -r requirements.txt
```

---

## 🚀 Execution Guide (Open 4 Terminals)

To get the full system running, you need to start four separate processes in order:

### ⛓️ Terminal 1: Local Blockchain (Hardhat)
Start your private solar ledger node.
```bash
cd Blockchain
npx hardhat node
```
*Note: This generates 20 test accounts. Account #0 is used by the system as the Admin.*

### ⚙️ Terminal 2: Smart Contract & Backend API
Deploy the GreenCoin contract and start the solar verification engine.
```bash
# 1. Deploy the contract
cd Blockchain
npx hardhat run scripts/deploy-civitas.js --network localhost

# 2. Start the FastAPI backend
cd ../backend
./venv/Scripts/activate
python main.py
```
*Wait for: `📁 .env file loaded: True` and `Uvicorn running on http://127.0.0.1:8000`*

### 💻 Terminal 3: Solar Intelligence Portal (Frontend)
Launch the interactive dashboard.
```bash
cd frontend
npm run dev
```
*Visit: [http://localhost:5174](http://localhost:5174)*

### 📡 Terminal 4: Data Feed (Emulator OR Real Hardware)
Connect your data source to the blockchain.

**Option A: Virtual Emulator (For Quick Demo)**
No hardware needed. Mimics real solar traffic and random fraud attempts.
```bash
cd hardware
python hardware_emulator.py
```

**Option B: Real Hardware (ESP32)**
1. Connect ESP32 via USB.
2. In `hardware/serial_reader.py`, set your COM port (e.g., `COM3`).
3. Run:
```bash
cd hardware
python serial_reader.py
```

---

## 💎 Key Features
- **AI-Driven Trust**: Uses an **Isolation Forest** model to detect fraudulent voltage injections (meter manipulation) in real-time.
- **Asynchronous Blockchain Logging**: High-speed data intake with background smart contract verification.
- **Immutable Audit Feed**: Real-time transaction history on a local Polygon node.
- **Government Audit Export**: Admin-side CSV export functionality for subsidy verification and compliance.
- **Solar Feasibility Check**: Cross-verifies logged data with time-of-day irradiance constraints.

---

## 👨‍💻 Submission Details
- **Team**: VisionX
- **Developed for**: Green Fintech Hackathon 2026
- **Repo**: [https://github.com/Chunnu-Munnu/Civitas-AI](https://github.com/Chunnu-Munnu/Civitas-AI)
- **Sustainability Focus**: Incentivizing household-level solar adoption through decentralized fractional rewards.

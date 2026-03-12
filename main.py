
import streamlit as st
import serial
import pandas as pd
import time
import numpy as np
from ml_model import SolarAnomalyModel
from database import init_db, create_user, get_user, update_coins, log_reading, get_history

# ---------------- INITIALIZE ----------------
init_db()
st.set_page_config(layout="wide", page_title="VISION-X Green FinTech")

# ---------------- STYLES (Professional Black & White) ----------------
st.markdown("""
<style>
    /* Main Background */
    .stApp {
        background-color: #000000;
        color: #FFFFFF;
        font-family: 'Roboto Mono', monospace;
    }
    
    /* Metrics */
    div[data-testid="stMetricValue"] {
        font-size: 24px;
        color: #FFFFFF;
        font-family: 'Courier New', monospace;
    }
    div[data-testid="stMetricLabel"] {
        color: #888888;
        font-size: 14px;
    }
    
    /* Borders for Cards */
    .stMetric {
        background-color: #111111 !important;
        border: 1px solid #333333;
        padding: 10px;
    }
    
    /* Buttons */
    .stButton > button {
        border-radius: 0px;
        border: 1px solid #FFFFFF;
        background-color: #000000;
        color: #FFFFFF;
        font-weight: bold;
        transition: all 0.2s;
    }
    .stButton > button:hover {
        background-color: #FFFFFF;
        color: #000000;
        border-color: #FFFFFF;
    }
    
    /* Remove Header/Footer */
    header {visibility: hidden;}
    footer {visibility: hidden;}
    
</style>
""", unsafe_allow_html=True)

st.title("⚡ VISION-X :: GREEN FINTECH TERMINAL")
st.caption("SECURE RENEWABLE ENERGY VERIFICATION NODE [v2.4]")

# ---------------- SESSION STATE ----------------
for key in ["user_id", "coins", "model", "data_buffer", "ser", "running", "penalty_until", "simulate_grid", "noise_threshold", "voltage_cutoff", "last_vals"]:
    if key not in st.session_state:
        if key == "model": st.session_state[key] = SolarAnomalyModel()
        elif key == "data_buffer": st.session_state[key] = []
        elif key in ["coins", "penalty_until"]: st.session_state[key] = 0.0
        elif key == "noise_threshold": st.session_state[key] = 0.05
        elif key == "voltage_cutoff": st.session_state[key] = 0.5
        elif key == "last_vals": st.session_state[key] = (0.0, 0.0, 0.0)
        else: st.session_state[key] = None

# ---------------- SIDEBAR (CONFIG ONLY) ----------------
with st.sidebar:
    st.header("SYSTEM CONFIG")
    if st.session_state.user_id:
        st.success(f"USER_ID: {st.session_state.user_id}")
        if st.button("LOGOUT [EXIT]"):
            if st.session_state.ser: st.session_state.ser.close()
            st.session_state.user_id = None
            st.session_state.running = False
            st.rerun()
    
    st.divider()
    st.markdown("### CALIBRATION")
    st.caption("Sensor Noise Filter")
    noise_threshold = st.slider("Min Current (A)", 0.0, 1.0, key="noise_threshold", step=0.01)
    voltage_cutoff = st.slider("Min Voltage (V)", 0.0, 2.0, key="voltage_cutoff", step=0.1)

# ---------------- AUTHENTICATION ----------------
if st.session_state.user_id is None:
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("ACCESS TERMINAL")
        uid_input = st.text_input("USER ID", placeholder="ENTER ID...")
        if st.button("LOGIN"):
            if uid_input:
                try:
                    user = get_user(int(uid_input))
                    if user:
                        st.session_state.user_id = user[0]
                        st.session_state.coins = user[3]
                        st.rerun()
                    else: st.error("ACCESS DENIED")
                except: st.error("INVALID INPUT")

    with c2:
        st.subheader("NEW USER")
        name = st.text_input("NAME")
        phone = st.text_input("PHONE")
        if st.button("REGISTER"):
            if name and phone:
                uid = create_user(name, phone)
                st.session_state.user_id = uid
                st.rerun()
else:
    # ---------------- MAIN DASHBOARD ----------------
    
    # 1. LIVE METRICS (Placeholders)
    m1, m2, m3, m4 = st.columns(4)
    coin_metric = m1.empty()
    status_metric = m2.empty()
    power_metric = m3.empty()
    current_metric = m4.empty()
    
    coin_metric.metric("TOKENS", f"{st.session_state.coins:.4f}")
    status_metric.info("Please Start System")
    
    st.divider()
    
    # 2. CONTROLS
    c1, c2, c3, c4 = st.columns([1, 1, 1, 2])
    with c1:
        port = st.text_input("PORT", value="COM7", label_visibility="collapsed", key="port_in")
    with c2:
        if not st.session_state.running:
            if st.button("▶ START", type="primary", use_container_width=True):
                try:
                    st.session_state.ser = serial.Serial(port, 115200, timeout=1)
                    st.session_state.running = True
                    st.rerun()
                except Exception as e:
                    st.error(f"ERR: {e}")
        else:
             if st.button("⏹ STOP", use_container_width=True):
                 st.session_state.running = False
                 if st.session_state.ser: st.session_state.ser.close()
                 st.rerun()
    with c3:
        # SIMULATION TOGGLE
        sim_mode = st.toggle("🚨 SIMULATE GRID ATTACK", value=st.session_state.simulate_grid, key="sim_toggle")
        st.session_state.simulate_grid = sim_mode
        
    with c4:
        if st.session_state.running:
            st.code("STATUS: MONITORING STREAM...", language="bash")
        else:
            st.code("STATUS: OFFLINE", language="bash")

    # 3. GRAPHS (Placeholders to prevent full redraw)
    g1, g2 = st.columns(2)
    chart_v = g1.empty()
    chart_p = g2.empty()

    # 4. LOGIC LOOP (Non-blocking UI update)
    if st.session_state.running:
        while True:
            # A. READ DATA
            voltage, current, power = st.session_state.last_vals
            
            if st.session_state.simulate_grid:
                voltage = 5.0
                current = 2.5
                power = voltage * current
                st.session_state.last_vals = (voltage, current, power)
                
            elif st.session_state.ser:
                got_new = False
                while st.session_state.ser.in_waiting > 0:
                    try:
                        line = st.session_state.ser.readline().decode(errors="ignore").strip()
                        if line and "," in line:
                            p = line.split(",")
                            if len(p) == 3:
                                rv, rc = float(p[0]), abs(float(p[1]))
                                v = 0.0 if rv < voltage_cutoff else rv
                                c = 0.0 if rc < noise_threshold else rc
                                voltage, current, power = v, c, v*c
                                got_new = True
                    except: pass
                
                if got_new:
                    st.session_state.last_vals = (voltage, current, power)
            
            # B. BUFFER
            st.session_state.data_buffer.append([voltage, current, power])
            if len(st.session_state.data_buffer) > 60:
                st.session_state.data_buffer.pop(0)
            
            # C. MODEL & STATUS
            status_text = "VERIFIED"
            status_color = "normal"
            is_anom = 0
            
            # Train if needed
            if len(st.session_state.data_buffer) >= 20 and not st.session_state.model.trained:
                st.session_state.model.train(list(st.session_state.data_buffer)[-20:])
                
            if st.session_state.model.trained:
                pred = st.session_state.model.predict([voltage, current, power])
                
                if pred == -1:
                    status_text = "🚨 FRAUD DETECTED"
                    is_anom = 1
                    status_metric.error(status_text)
                elif power < 0.001:
                    status_text = "💤 IDLE"
                    status_metric.info(status_text)
                else:
                     status_text = "✅ SECURED"
                     gain = power * 0.0001
                     st.session_state.coins += gain
                     status_metric.success(status_text)
                     update_coins(st.session_state.user_id, st.session_state.coins)

            # D. UI UPDATES (Fast)
            coin_metric.metric("TOKENS", f"{st.session_state.coins:.4f}")
            power_metric.metric("POWER", f"{power*1000:.1f} mW")
            current_metric.metric("CURRENT", f"{current*1000:.1f} mA")
            
            # Graphs
            df = pd.DataFrame(st.session_state.data_buffer, columns=["V", "C", "P"])
            chart_v.line_chart(df["V"], height=250) # Auto-updates without full rerun
            chart_p.line_chart(df["P"], height=250)
            
            # Log
            log_reading(st.session_state.user_id, voltage, current, power, is_anom, 0)
            
            # Loop control
            time.sleep(0.1) # Fast refresh
            
    else:
        st.divider()
        st.caption("RECENT AUDIT LOG")
        hist = get_history(st.session_state.user_id, 10)
        st.dataframe(pd.DataFrame(hist, columns=["TS", "V", "C", "P", "FRAUD_FLAG"]))

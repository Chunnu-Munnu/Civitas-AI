import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestRegressor
import joblib
import os
import requests
from datetime import datetime

class CIVITASML:
    def __init__(self):
        self.anomaly_detector = IsolationForest(contamination=0.05, random_state=42)
        self.generation_predictor = RandomForestRegressor(n_estimators=100, random_state=42)
        self.anomaly_trained = False
        self.predictor_trained = False
        self.nasa_api_url = "https://power.larc.nasa.gov/api/temporal/daily/point"

    def get_nasa_irradiance(self, lat, lon):
        """Fetch real-time solar irradiance for cross-validation"""
        try:
            today = datetime.now().strftime("%Y%m%d")
            params = {
                "parameters": "ALLSKY_SFC_SW_DWN",
                "community": "RE",
                "longitude": lon,
                "latitude": lat,
                "start": today,
                "end": today,
                "format": "JSON"
            }
            response = requests.get(self.nasa_api_url, params=params, timeout=5)
            data = response.json()
            # Extract irradiance (kW-hr/m^2/day)
            return data['properties']['parameter']['ALLSKY_SFC_SW_DWN'][today]
        except Exception as e:
            print(f"NASA API Error: {e}")
            return 0.5 # Default fallback irradiance

    def predict_expected_gen(self, panel_capacity, time_of_day, irradiance):
        if not self.predictor_trained:
            # Physical formula: Output = Capacity * Irradiance * Efficiency * Correction
            # Efficiency ~15%, Correction ~0.7
            return panel_capacity * irradiance * 0.15 * 0.7 
        return self.generation_predictor.predict([[panel_capacity, time_of_day, irradiance]])[0]

    def detect_anomaly(self, voltage, current, power):
        # Physics-based fraud detection
        if voltage > 2.0:
            return -1 # Fraud (Fake Grid)
        
        # ML-based statistical anomaly detection
        if self.anomaly_trained:
            pred = self.anomaly_detector.predict([[voltage, current, power]])
            return pred[0]
        
        # Default pass if voltage is within solar range
        if 0.0 < voltage < 1.5:
            return 1
            
        return 1

    def train_anomaly(self, data):
        self.anomaly_detector.fit(data)
        self.anomaly_trained = True

ml_service = CIVITASML()

# Top-level exports for main.py
def detect_anomaly(voltage, current, power):
    return ml_service.detect_anomaly(voltage, current, power)

def predict_generation(panel_capacity, time_of_day, irradiance):
    return ml_service.predict_expected_gen(panel_capacity, time_of_day, irradiance)

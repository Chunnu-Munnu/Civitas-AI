import numpy as np
from sklearn.ensemble import IsolationForest
import threading
import time

# Rolling buffer of real readings for self-training
_training_buffer = []
_lock = threading.Lock()

class CIVITASML:
    def __init__(self):
        self.anomaly_detector = IsolationForest(
            n_estimators=100,
            contamination=0.03,   # was 0.05 — lowered to reduce false positives on sparse data
            random_state=42
        )
        self.anomaly_trained = False
        self._start_retrain_loop()

    # ── Physics bounds ──────────────────────────────────────────────
    # Single solar cell: Voc ≈ 0.6–1.0V, absolute max ~1.5V
    # Set to 2.0V to catch fake-grid injection (24V) without false-flagging real panels
    VOLTAGE_MAX = 2.0      # V  — single cell can't exceed this
    VOLTAGE_MIN = 0.0      # V
    CURRENT_MAX = 0.05     # A  — 50mA max for small panel
    POWER_MAX   = 0.1      # W  — 100mW max

    # ML only activates after enough clean readings to avoid early false positives
    ML_MIN_SAMPLES = 50    # was 20 — 0.3mA spikes were flagged with too few samples

    def _physics_check(self, voltage, current, power):
        if voltage > self.VOLTAGE_MAX:
            return -1, f"Physics: voltage {voltage:.2f}V exceeds solar max ({self.VOLTAGE_MAX}V) — grid injection?"
        if voltage < 0 or current < 0 or power < 0:
            return -1, "Physics: negative sensor value"
        if current > self.CURRENT_MAX:
            return -1, f"Physics: current {current*1000:.2f}mA exceeds solar max ({self.CURRENT_MAX*1000:.0f}mA)"
        if power > self.POWER_MAX:
            return -1, f"Physics: power {power*1000:.2f}mW exceeds panel rating ({self.POWER_MAX*1000:.0f}mW)"
        return 1, None

    # ── ML detection ────────────────────────────────────────────────
    def detect_anomaly(self, voltage, current, power):
        """Returns (label, reason) where label: 1=normal, -1=anomaly"""
        label, reason = self._physics_check(voltage, current, power)
        if label == -1:
            return -1, reason

        if self.anomaly_trained and len(_training_buffer) >= self.ML_MIN_SAMPLES:
            features = [[voltage, current, power]]
            pred = self.anomaly_detector.predict(features)
            if pred[0] == -1:
                score = self.anomaly_detector.score_samples(features)[0]
                return -1, f"ML Isolation Forest: anomaly score {score:.3f}"

        # Add to training buffer (only on 'likely-normal' readings)
        with _lock:
            _training_buffer.append([voltage, current, power])
            if len(_training_buffer) > 5000:
                _training_buffer.pop(0)

        return 1, None

    # ── Self-retraining loop ─────────────────────────────────────────
    def _retrain(self):
        while True:
            time.sleep(30)
            with _lock:
                buf = list(_training_buffer)
            if len(buf) >= self.ML_MIN_SAMPLES:
                try:
                    self.anomaly_detector.fit(buf)
                    self.anomaly_trained = True
                    print(f"🤖 ML Model retrained on {len(buf)} samples")
                except Exception as e:
                    print(f"⚠️ Retrain error: {e}")

    def _start_retrain_loop(self):
        t = threading.Thread(target=self._retrain, daemon=True)
        t.start()

# ── Singleton ────────────────────────────────────────────────────────
ml_service = CIVITASML()

def detect_anomaly(voltage, current, power):
    """Returns (int_label, reason_str). label=-1 means anomaly."""
    return ml_service.detect_anomaly(voltage, current, power)

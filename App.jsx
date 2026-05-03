import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

const API = "http://127.0.0.1:8000";
const POLL_MS = 1200;
const MAX_HISTORY = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, d = 2) { return typeof n === "number" ? n.toFixed(d) : "–"; }
function ts(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Sub-components ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    GREEN:  { bg: "#16a34a", text: "#fff", label: "VERIFIED" },
    ANOMALY:{ bg: "#dc2626", text: "#fff", label: "ANOMALY" },
    IDLE:   { bg: "#6b7280", text: "#fff", label: "IDLE" },
  }[status] || { bg: "#6b7280", text: "#fff", label: status };

  return (
    <span style={{
      background: cfg.bg, color: cfg.text,
      borderRadius: 6, padding: "3px 14px",
      fontFamily: "monospace", fontWeight: 700, fontSize: 13,
      letterSpacing: 2, display: "inline-block",
      animation: status === "ANOMALY" ? "blink 0.8s infinite" : "none",
    }}>
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, unit, accent }) {
  return (
    <div style={{
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)",
      padding: "14px 18px", minWidth: 110,
    }}>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: accent || "var(--color-text-primary)", fontFamily: "monospace" }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4, color: "var(--color-text-secondary)" }}>{unit}</span>
      </div>
    </div>
  );
}

function WeatherPanel({ weather }) {
  if (!weather) return null;
  const irr  = weather.shortwave_radiation ?? 0;
  const cloud = weather.cloud_cover ?? 0;
  const sun   = weather.sunshine_duration ?? 0;
  const solarGood = irr > 100;

  return (
    <div style={{
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: "var(--border-radius-lg)",
      padding: "16px 20px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 10 }}>
        OPEN-METEO WEATHER
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Solar irradiance</div>
          <div style={{ fontFamily: "monospace", fontWeight: 500, color: solarGood ? "#16a34a" : "#dc2626" }}>
            {fmt(irr, 1)} W/m²
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Cloud cover</div>
          <div style={{ fontFamily: "monospace", fontWeight: 500 }}>{fmt(cloud, 0)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Sunshine</div>
          <div style={{ fontFamily: "monospace", fontWeight: 500 }}>{fmt(sun, 0)}s/hr</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Solar check</div>
          <div style={{ fontWeight: 500, color: solarGood ? "#16a34a" : "#dc2626" }}>
            {solarGood ? "GOOD" : "LOW"}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertPanel({ reasons, status }) {
  if (status !== "ANOMALY" || !reasons?.length) return null;
  return (
    <div style={{
      background: "#fef2f2",
      border: "0.5px solid #fca5a5",
      borderLeft: "3px solid #dc2626",
      borderRadius: "var(--border-radius-md)",
      padding: "12px 16px",
    }}>
      <div style={{ fontWeight: 500, color: "#dc2626", marginBottom: 6, fontSize: 13 }}>
        ANOMALY DETECTED
      </div>
      {reasons.map((r, i) => (
        <div key={i} style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 2 }}>
          • {r}
        </div>
      ))}
    </div>
  );
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: 6, padding: "8px 12px", fontSize: 12,
    }}>
      <div style={{ color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: "monospace" }}>
          {p.name}: {Number(p.value).toFixed(3)}
        </div>
      ))}
    </div>
  );
}

// Login page
function LoginPage({ onLogin }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
    } catch (_) {}
    onLogin({ name: name.trim(), phone: phone.trim() });
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--color-background-tertiary)",
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "40px 48px", width: 360,
      }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Civitas AI</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Decentralized solar verification portal
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Full name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Amogh"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Phone number
          </label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !name || !phone}
          style={{ width: "100%", padding: "10px 0", fontSize: 14 }}
        >
          {loading ? "Connecting..." : "Enter Dashboard ↗"}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [live, setLive]         = useState(null);
  const [history, setHistory]   = useState([]);
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [connected, setConnected] = useState(false);

  const poll = useCallback(async () => {
    try {
      const [liveRes, histRes] = await Promise.all([
        fetch(`${API}/data`).then(r => r.json()),
        fetch(`${API}/history?limit=60`).then(r => r.json()),
      ]);
      setLive(liveRes);
      setConnected(true);

      // Chart data
      const pts = histRes.map((r, i) => ({
        t:       ts(r.timestamp),
        voltage: r.voltage,
        power:   r.power * 1000,   // mW for readability
        status:  r.status,
      }));
      setChartData(pts);

      // Alert history (last 10 anomalies)
      const newAlerts = histRes
        .filter(r => r.status === "ANOMALY")
        .slice(-10)
        .reverse()
        .map(r => ({
          time:    ts(r.timestamp),
          reasons: r.anomaly_reason ? r.anomaly_reason.split("; ") : [],
          voltage: r.voltage,
          power:   r.power,
        }));
      setAlerts(newAlerts);

    } catch (_) {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [user, poll]);

  if (!user) return <LoginPage onLogin={setUser} />;

  const status = live?.status || "IDLE";
  const isAnomaly = status === "ANOMALY";

  return (
    <div style={{
      minHeight: "100vh",
      background: isAnomaly
        ? "linear-gradient(135deg, #fff5f5 0%, var(--color-background-tertiary) 40%)"
        : "var(--color-background-tertiary)",
      transition: "background 0.6s",
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      `}</style>

      {/* Header */}
      <div style={{
        background: "var(--color-background-primary)",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 500, fontSize: 16 }}>Civitas AI</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Solar Verification</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: connected ? "#16a34a" : "#dc2626", fontFamily: "monospace" }}>
            {connected ? "● LIVE" : "○ OFFLINE"}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {user.name}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>

        {/* Status row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>NODE STATUS</div>
            <StatusBadge status={status} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>GREEN COINS</div>
            <div style={{
              fontSize: 28, fontWeight: 500, fontFamily: "monospace",
              color: "#16a34a",
              animation: status === "GREEN" ? "pulse 2s infinite" : "none",
            }}>
              {fmt(live?.coins_balance ?? 50, 2)}
            </div>
          </div>
        </div>

        {/* Anomaly alert */}
        <div style={{ marginBottom: 16 }}>
          <AlertPanel reasons={live?.reasons} status={status} />
        </div>

        {/* Live metrics */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <MetricCard label="Voltage" value={fmt(live?.voltage, 3)} unit="V"
            accent={isAnomaly ? "#dc2626" : undefined} />
          <MetricCard label="Current" value={fmt((live?.current ?? 0) * 1000, 1)} unit="mA" />
          <MetricCard label="Power" value={fmt((live?.power ?? 0) * 1000, 1)} unit="mW" />
          <MetricCard label="ML Score" value={fmt(live?.ml_score, 3)} unit=""
            accent={live?.ml_score < -0.5 ? "#dc2626" : undefined} />
          <MetricCard label="Coins delta" value={live?.coins_delta >= 0 ? `+${fmt(live?.coins_delta, 4)}` : fmt(live?.coins_delta, 4)} unit=""
            accent={live?.coins_delta < 0 ? "#dc2626" : "#16a34a"} />
        </div>

        {/* Weather panel */}
        <div style={{ marginBottom: 20 }}>
          <WeatherPanel weather={live?.weather} />
        </div>

        {/* Charts */}
        <div style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 14 }}>
            VOLTAGE OVER TIME
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 7]} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone" dataKey="voltage" name="Voltage (V)"
                  stroke="#16a34a" strokeWidth={1.5} dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 14 }}>
            POWER OUTPUT (mW)
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone" dataKey="power" name="Power (mW)"
                  stroke="#2563eb" strokeWidth={1.5} dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alert history */}
        {alerts.length > 0 && (
          <div style={{
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 14 }}>
              ANOMALY LOG
            </div>
            {alerts.map((a, i) => (
              <div key={i} style={{
                borderBottom: i < alerts.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
                padding: "8px 0",
                fontSize: 12,
              }}>
                <span style={{ color: "#dc2626", fontFamily: "monospace", marginRight: 12 }}>{a.time}</span>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  V={fmt(a.voltage, 2)}V  P={fmt(a.power * 1000, 0)}mW
                </span>
                {a.reasons.map((r, j) => (
                  <div key={j} style={{ color: "#7f1d1d", marginLeft: 80 }}>• {r}</div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react'
import {
  Zap, TrendingUp, ShieldCheck, ShieldAlert, Clock,
  Coins, AlertTriangle, CheckCircle, Activity, Cloud, Sun, Wind
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'

const API = 'http://localhost:8000'

// Auto-scale unit helpers
function fmtPower(watts) {
  if (typeof watts !== 'number') return '–'
  const uW = watts * 1_000_000
  if (uW >= 1000) return `${(uW / 1000).toFixed(3)} mW`
  return `${uW.toFixed(1)} µW`
}
function fmtCurrent(amps) {
  if (typeof amps !== 'number') return '–'
  const uA = amps * 1_000_000
  if (uA >= 1000) return `${(uA / 1000).toFixed(2)} mA`
  return `${uA.toFixed(1)} µA`
}

function StatusBadge({ isAnomaly, power }) {
  if (power === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
        <Clock size={16} />IDLE / WAITING
      </div>
    )
  }
  if (isAnomaly) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
        <ShieldAlert size={16} />ANOMALY DETECTED
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
      <CheckCircle size={16} />VERIFIED
    </div>
  )
}

function MetricCard({ label, value, unit, sub, icon, color }) {
  return (
    <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={`p-2 rounded-lg ${color}`}>{icon}</span>
      </div>
      <div>
        <span className="text-3xl font-bold text-white font-mono">{value}</span>
        <span className="text-gray-400 text-sm ml-1">{unit}</span>
      </div>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function WeatherPanel({ weather }) {
  if (!weather || !weather.ok) {
    return (
      <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Cloud size={16} className="text-blue-400" /> Live Weather
        </h3>
        <p className="text-gray-500 text-sm">Loading Open-Meteo data...</p>
      </div>
    )
  }
  const { cloud_cover, direct_radiation } = weather
  const irradiance_pct = Math.min(100, Math.round((direct_radiation / 1000) * 100))
  const solarFeasible = direct_radiation > 10 && cloud_cover < 80

  return (
    <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Cloud size={16} className="text-blue-400" /> Live Weather · Open-Meteo
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <Sun size={24} className="mx-auto text-yellow-400 mb-1" />
          <p className="text-2xl font-bold text-white font-mono">{direct_radiation.toFixed(0)}</p>
          <p className="text-gray-500 text-xs">W/m² radiation</p>
        </div>
        <div className="text-center">
          <Cloud size={24} className="mx-auto text-blue-400 mb-1" />
          <p className="text-2xl font-bold text-white font-mono">{cloud_cover}%</p>
          <p className="text-gray-500 text-xs">cloud cover</p>
        </div>
        <div className="text-center">
          <Zap size={24} className={`mx-auto mb-1 ${solarFeasible ? 'text-emerald-400' : 'text-gray-500'}`} />
          <p className={`text-sm font-bold ${solarFeasible ? 'text-emerald-400' : 'text-gray-500'}`}>
            {solarFeasible ? 'OPTIMAL' : 'LOW LIGHT'}
          </p>
          <p className="text-gray-500 text-xs">solar feasibility</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Irradiance</span><span>{irradiance_pct}%</span>
        </div>
        <div className="w-full bg-[#0A1628] rounded-full h-2">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-1000"
            style={{ width: `${irradiance_pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics]   = useState({ power: 0, voltage: 0, current: 0, dailyYield: 0, balance: 15.5 })
  const [history, setHistory]   = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [weather, setWeather]   = useState(null)
  const [latestTx, setLatestTx] = useState('None')
  const [lastAnomaly, setLastAnomaly] = useState(false)
  const [coinFlash, setCoinFlash] = useState(false)
  const [prevBalance, setPrevBalance] = useState(15.5)

  const user = JSON.parse(localStorage.getItem('civitas_user') || '{}')

  // ── FAST poll: sensor data every 800ms via /api/live (instant) ─────
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`${API}/api/live`)
        if (!res.ok) return
        const d = await res.json()
        const newMetrics = d.metrics || {}

        // Coin flash animation
        if (newMetrics.balance !== prevBalance) {
          setCoinFlash(true)
          setPrevBalance(newMetrics.balance)
          setTimeout(() => setCoinFlash(false), 600)
        }

        setMetrics(newMetrics)
        setHistory(d.history || [])
        setAnomalies(d.recent_anomalies || [])
        setLatestTx(d.latest_tx || 'None')
        if (d.weather && Object.keys(d.weather).length > 0) {
          setWeather(d.weather)
        }

        const h = d.history || []
        setLastAnomaly(h.length > 0 ? h[h.length - 1].is_anomaly : false)
      } catch {
        // keep last known state
      }
    }

    fetchLive()
    const id = setInterval(fetchLive, 800)
    return () => clearInterval(id)
  }, [])

  // ── SLOW poll: weather every 30s ──────────────────────────────────
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${API}/api/weather`)
        if (res.ok) setWeather(await res.json())
      } catch {}
    }
    fetchWeather()
    const id = setInterval(fetchWeather, 30000)
    return () => clearInterval(id)
  }, [])

  const co2Saved = ((metrics.balance || 0) * 0.82).toFixed(3)
  const txShort  = latestTx !== 'None' ? latestTx.slice(0, 14) + '...' : 'Awaiting reading'

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">
            Real-time monitoring · ESP32 + INA219 + LCD · Open-Meteo weather
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge isAnomaly={lastAnomaly} power={metrics.power} />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="GreenCoin Balance"
          value={(metrics.balance || 0).toFixed(4)}
          unit="GRN"
          sub={coinFlash ? '⚡ +0.01 GRN minted!' : 'Earning per verified reading'}
          icon={<Coins size={18} className={coinFlash ? 'text-green-300 animate-bounce' : 'text-yellow-400'} />}
          color={coinFlash ? 'bg-green-500/20' : 'bg-yellow-500/10'}
        />
        <MetricCard
          label="Power Output"
          value={fmtPower(metrics.power || 0)}
          unit=""
          sub={`${(metrics.voltage || 0).toFixed(3)}V · ${fmtCurrent(metrics.current || 0)}`}
          icon={<Zap size={18} className="text-blue-400" />}
          color="bg-blue-500/10"
        />
        <MetricCard
          label="CO₂ Offset"
          value={co2Saved}
          unit="kg"
          sub="India grid factor 0.82 kg/kWh"
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          color="bg-emerald-500/10"
        />
        <MetricCard
          label="Readings Logged"
          value={history.length.toLocaleString()}
          unit="cycles"
          sub={`Last TX: ${txShort}`}
          icon={<Activity size={18} className="text-purple-400" />}
          color="bg-purple-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Voltage (V)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="t" hide />
              <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 8 }}
                formatter={v => [`${v.toFixed(3)} V`, 'Voltage']}
              />
              <Area type="monotone" dataKey="voltage" stroke="#F5A623" fill="url(#vGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Power (µW)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={history.map(h => ({ ...h, power_uw: h.power * 1_000_000 }))}>
              <defs>
                <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2ECC71" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="t" hide />
              <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 8 }}
                formatter={v => [`${v.toFixed(1)} µW`, 'Power']}
              />
              <Area type="monotone" dataKey="power_uw" stroke="#2ECC71" fill="url(#pGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weather + Anomaly Log row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeatherPanel weather={weather} />

        {/* Anomaly Feed */}
        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            Anomaly Log
            {anomalies.length > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {anomalies.length} flagged
              </span>
            )}
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {anomalies.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm italic">
                <ShieldCheck size={16} className="mr-2 text-emerald-500" />
                No anomalies — system secure
              </div>
            ) : (
              [...anomalies].reverse().map((a, idx) => (
                <div key={idx} className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-red-300 font-semibold">🚩 FRAUD DETECTED</span>
                    <span className="text-gray-500">{new Date(a.t).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-gray-400">{a.reason || 'Unknown anomaly'}</p>
                  <p className="text-gray-600 mt-0.5 font-mono">
                    {(a.voltage || 0).toFixed(3)}V · {fmtPower(a.power || 0)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

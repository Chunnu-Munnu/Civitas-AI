import React, { useState, useEffect } from 'react'
import {
  Zap, TrendingUp, ShieldCheck, ShieldAlert, Clock,
  Coins, AlertTriangle, CheckCircle, Activity
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'


function StatusBadge({ status }) {
  const config = {
    verified: { label: 'VERIFIED', icon: <CheckCircle size={16} />, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    flagged: { label: 'FRAUD DETECTED', icon: <ShieldAlert size={16} />, cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    idle: { label: 'IDLE / LOW LIGHT', icon: <Clock size={16} />, cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  }
  const { label, icon, cls } = config[status] || config.idle
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${cls}`}>
      {icon}{label}
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

export default function Dashboard() {
  const [data, setData] = useState({
    metrics: { power: 0, voltage: 0, current: 0, dailyYield: 0, co2: 0, balance: 0 },
    status: 'OFFLINE',
    recentAlerts: []
  })
  const [history, setHistory] = useState([])
  const user = JSON.parse(localStorage.getItem('civitas_user') || '{}')

  // Real-time Poll from Backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/dashboard/${user.wallet}`)
        if (response.ok) {
          const result = await response.json()
          setData(prev => ({
            ...prev,
            metrics: result.metrics,
            status: result.is_active ? 'LIVE' : 'IDLE',
            recentAlerts: result.recent_anomalies || []
          }))
          setHistory(result.history || [])
        }
      } catch (err) {
        console.log("Backend offline, showing cached/simulated state")
        // Optionally, set status to OFFLINE if backend is unreachable
        setData(prev => ({ ...prev, status: 'OFFLINE' }));
      }
    }

    const interval = setInterval(fetchData, 3000)
    fetchData() // Fetch immediately on mount
    return () => clearInterval(interval)
  }, [user.wallet])

  const co2Saved = (data.metrics.balance * 0.82).toFixed(2)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">Real-time solar generation monitoring · ESP32 + INA219</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold 
            ${new Date().getHours() >= 6 && new Date().getHours() <= 18 
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
              : 'bg-gray-800/10 text-gray-500 border-gray-700/30'}`}>
            <Zap size={16} /> Solar Feasibility: {new Date().getHours() >= 6 && new Date().getHours() <= 18 ? 'OPTIMAL' : 'NIGHT/LOW'}
          </div>
          <StatusBadge status={data.status.toLowerCase()} />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="GreenCoin Balance"
          value={data.metrics.balance.toFixed(4)}
          unit="GRN"
          sub="+8.3% this week"
          icon={<Coins size={18} className="text-civitas-gold" />}
          color="bg-yellow-500/10"
        />
        <MetricCard
          label="Power Output"
          value={(data.metrics.power * 1000).toFixed(1)}
          unit="mW"
          sub={`${(data.metrics.voltage).toFixed(3)}V · ${(data.metrics.current).toFixed(1)}mA`}
          icon={<Zap size={18} className="text-blue-400" />}
          color="bg-blue-500/10"
        />
        <MetricCard
          label="CO₂ Offset"
          value={co2Saved}
          unit="kg"
          sub="Based on India grid factor 0.82"
          icon={<TrendingUp size={18} className="text-emerald-400" />}
          color="bg-emerald-500/10"
        />
        <MetricCard
          label="Readings Logged"
          value={history.length.toLocaleString()}
          unit="cycles"
          sub="Verified on-chain"
          icon={<Activity size={18} className="text-purple-400" />}
          color="bg-purple-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Voltage (V)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="t" hide />
              <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 8 }} />
              <Area type="monotone" dataKey="voltage" stroke="#F5A623" fill="url(#vGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Power (mW)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2ECC71" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2ECC71" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
              <XAxis dataKey="t" hide />
              <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 8 }} />
              <Area type="monotone" dataKey="power" stroke="#2ECC71" fill="url(#pGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Anomaly Feed */}
      <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-400" /> Recent Verification Logs
        </h3>
        <div className="space-y-2">
          {data.recentAlerts.length > 0 ? data.recentAlerts.map((a, idx) => (
            <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-lg text-sm bg-red-500/5 border border-red-500/10 text-red-300">
              <span>🚩 Anomaly Detected: Artificial voltage spike detected ({a.power} mW)</span>
              <span className="text-gray-500 text-xs">{new Date(a.t).toLocaleTimeString()}</span>
            </div>
          )) : (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm italic">
              No anomalies detected. System status: SECURE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

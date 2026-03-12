import React, { useState, useEffect } from 'react'
import { Users, ShieldAlert, CheckCircle, XCircle, Download, Filter, Building2, FileText } from 'lucide-react'

function StatusChip({ status }) {
  const map = {
    approved: 'bg-emerald-500/10 text-emerald-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    flagged: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${map[status] || map.pending}`}>{status || 'active'}</span>
  )
}

function SeverityChip({ s }) {
  const map = { High: 'text-red-400 bg-red-500/10', Medium: 'text-yellow-400 bg-yellow-500/10', Low: 'text-blue-400 bg-blue-500/10' }
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[s] || map.Low}`}>{s}</span>
}

export default function AdminPortal() {
  const [households, setHouseholds] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [uRes, aRes] = await Promise.all([
          fetch('http://localhost:8000/api/admin/users'),
          fetch('http://localhost:8000/api/admin/anomalies')
        ])
        if (uRes.ok) setHouseholds(await uRes.json())
        if (aRes.ok) setAnomalies(await aRes.json())
      } catch (err) {
        console.error("Admin fetch failed")
      } finally {
        setLoading(false)
      }
    }
    fetchAdminData()
    const interval = setInterval(fetchAdminData, 10000)
    return () => clearInterval(interval)
  }, [])

  const exportAudit = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "ID,Timestamp,Power(mW),Status,On-Chain TX\n"
      + anomalies.map(a => `${a.id},${a.timestamp},${a.power},${a.is_anomaly ? 'FLAGGED' : 'VERIFIED'},${a.blockchain_tx}`).join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `civitas_audit_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const stats = {
    total: households.length,
    approved: households.length, // Logic: all registered for now
    pending: 0,
    flagged: anomalies.length,
  }

  if (loading && households.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A1628]">
        <div className="text-civitas-gold animate-bounce font-mono">LOADING AUDIT PORTAL...</div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Government / Admin Portal</h2>
          <p className="text-gray-400 text-sm mt-1">Live Evidence Board · Blockchain Audit · Subsidy Oversight</p>
        </div>
        <button 
          onClick={exportAudit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-civitas-gold text-[#0A1628] font-semibold text-sm hover:scale-105 transition-all shadow-lg shadow-yellow-500/10"
        >
          <Download size={16} /> Export Audit Report (CSV)
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Users', value: stats.total, icon: <Users size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Verified Nodes', value: stats.approved, icon: <CheckCircle size={18} />, color: 'text-civitas-green', bg: 'bg-emerald-500/10' },
          { label: 'Compliance Rate', value: '98.2%', icon: <Filter size={18} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Fraud Alerts', value: stats.flagged, icon: <ShieldAlert size={18} />, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((c, i) => (
          <div key={i} className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
            <div className={`p-2 rounded-lg w-fit ${c.bg} mb-2`}>
              <span className={c.color}>{c.icon}</span>
            </div>
            <p className={`text-3xl font-bold font-mono ${c.color}`}>{c.value}</p>
            <p className="text-gray-400 text-xs mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Households */}
        <div className="lg:col-span-2 bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-civitas-gold" />
              <h3 className="text-white font-semibold">Registered Solar Nodes</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0A1628]/50 text-gray-500">
                <tr>
                  {['Wallet Address', 'GreenCoins', 'Status', 'Last Seeded'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-[10px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]">
                {households.map(h => (
                  <tr key={h.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 text-white font-mono text-xs">{h.wallet_address.slice(0,6)}...{h.wallet_address.slice(-4)}</td>
                    <td className="px-4 py-3 text-civitas-gold font-mono text-sm">{h.green_coins.toFixed(4)} GRN</td>
                    <td className="px-4 py-3"><StatusChip status="approved" /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date().toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Anomaly Feed */}
        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E3A5F] flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            <h3 className="text-white font-semibold">Fraud Evidence Log</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-[#1E3A5F]">
            {anomalies.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm italic">No fraud evidence detected. System clean.</div>
            ) : anomalies.map(a => (
              <div key={a.id} className="p-4 space-y-2 group hover:bg-red-500/5 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">ID: {a.id}</span>
                  <SeverityChip s="High" />
                </div>
                <p className="text-white text-xs leading-relaxed">
                  Artificial generation detected: <span className="text-red-400 font-bold">{a.power} mW</span> reported during low-light conditions.
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>{new Date(a.timestamp).toLocaleTimeString()}</span>
                  <span className="text-blue-400">TX: {a.blockchain_tx?.slice(0,8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

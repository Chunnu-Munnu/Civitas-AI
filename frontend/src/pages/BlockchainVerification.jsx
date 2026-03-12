import React, { useState, useEffect } from 'react'
import { ShieldCheck, ExternalLink, Copy, Check, Database, Hash } from 'lucide-react'


function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-white">
      {copied ? <Check size={12} className="text-civitas-green" /> : <Copy size={12} />}
    </button>
  )
}

function truncate(str, n = 12) {
  return str.length > n * 2 ? `${str.slice(0, n)}...${str.slice(-n)}` : str
}

export default function BlockchainVerification() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/readings/all')
        if (response.ok) {
          const data = await response.json()
          setRecords(data)
        }
      } catch (err) {
        console.error("Failed to fetch real-time records")
      } finally {
        setLoading(false)
      }
    }
    fetchRecords()
    const interval = setInterval(fetchRecords, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Safety timeout: if backend doesn't respond in 4s, show the empty state
    const timer = setTimeout(() => {
      setLoading(false)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A1628]">
        <div className="flex flex-col items-center gap-4">
          <div className="text-civitas-green font-mono animate-pulse">CONNECTING TO CIVITAS NODE...</div>
          <p className="text-gray-500 text-xs">Verify your backend (port 8000) is running</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Blockchain Verification</h2>
        <p className="text-gray-400 text-sm mt-1">Immutable records · Polygon Localhost · IPFS Storage</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: records.length, icon: <Database size={18} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Verified Hash', value: records.filter(r => r.blockchain_tx).length, icon: <ShieldCheck size={18} />, color: 'text-civitas-green', bg: 'bg-emerald-500/10' },
          { label: 'Total kW Logged', value: (records.reduce((acc, r) => acc + r.power, 0) / 1000).toFixed(4), icon: <Hash size={18} />, color: 'text-civitas-gold', bg: 'bg-yellow-500/10' },
          { label: 'Anomalies Caught', value: records.filter(r => r.is_anomaly).length, icon: <ShieldCheck size={18} />, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((c, i) => (
          <div key={i} className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className={`p-2 rounded-lg ${c.bg} ${c.color}`}>{c.icon}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</p>
            <p className="text-gray-400 text-xs mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Records Table */}
      <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E3A5F]">
          <h3 className="text-white font-semibold">Immutable Generation History</h3>
          <p className="text-gray-500 text-xs mt-1">Real-time solar data verified via ML and signed on-chain</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E3A5F]">
                {['ID', 'Timestamp', 'mW Output', 'TX Hash', 'IPFS Report', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-gray-500 font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]">
              {records.length === 0 ? (
                <tr><td colSpan="6" className="p-10 text-center text-gray-500 italic">No real-time records found. Start the ESP32 bridge to log data.</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{r.id}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td className="px-4 py-3 text-civitas-gold font-mono font-bold text-xs">{r.power} mW</td>
                  <td className="px-4 py-3">
                    {r.blockchain_tx ? (
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-mono text-xs">{truncate(r.blockchain_tx, 8)}</span>
                        <CopyButton text={r.blockchain_tx} />
                      </div>
                    ) : <span className="text-gray-600 text-xs">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400 font-mono text-xs">{truncate(r.ipfs_hash || '', 8)}</span>
                      <CopyButton text={r.ipfs_hash || ''} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold
                      ${!r.is_anomaly ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {!r.is_anomaly ? '✓ Verified' : '✗ Flagged'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

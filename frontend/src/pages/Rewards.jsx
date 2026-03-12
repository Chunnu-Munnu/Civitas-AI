import React, { useState, useEffect } from 'react'
import { Coins, Trophy, Gift, ArrowUpRight, Zap, ShoppingBag, Leaf } from 'lucide-react'

const MARKETPLACE = [
  { id: 1, title: 'Electricity Bill Discount', desc: '10% off next BESCOM bill', cost: 5, icon: <Zap size={22} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { id: 2, title: 'Green Store Voucher', desc: '₹200 off at GreenMart', cost: 2, icon: <ShoppingBag size={22} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 3, title: 'Carbon Offset Certificate', desc: '1 kg CO₂ offset certified', cost: 1, icon: <Leaf size={22} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 4, title: 'Solar Panel Cleaning', desc: 'Professional cleaning service', cost: 10, icon: <Gift size={22} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
]

export default function Rewards() {
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState([])
  const [redeemed, setRedeemed] = useState(null)
  const user = JSON.parse(localStorage.getItem('civitas_user') || '{}')

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/dashboard/${user.wallet}`)
        if (response.ok) {
          const result = await response.json()
          setBalance(result.metrics.balance)
          // Map backend history to reward transactions
          const rewardLogs = result.history.slice(0, 10).map(r => ({
            id: r.id,
            date: new Date(r.timestamp).toLocaleString(),
            amount: `+${(r.power * 0.0001).toFixed(4)}`, // Reward logic: 1 GRN per 10kWh roughly
            source: 'Solar Generation Rewards',
            type: 'credit'
          }))
          setHistory(rewardLogs)
        }
      } catch (err) {
        console.error("Backend offline")
      }
    }
    fetchRewards()
    const interval = setInterval(fetchRewards, 5000)
    return () => clearInterval(interval)
  }, [user.wallet])

  function handleRedeem(item) {
    if (balance >= item.cost) {
      setBalance(b => +(b - item.cost).toFixed(4))
      setRedeemed(item.id)
      setTimeout(() => setRedeemed(null), 3000)
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">GreenCoin Rewards</h2>
        <p className="text-gray-400 text-sm mt-1">Earn for verified solar generation · Redeem for real-world benefits</p>
      </div>

      {/* Balance Widget */}
      <div className="bg-gradient-to-br from-[#1a2f10] to-[#0F1F3D] border border-civitas-green/30 rounded-3xl p-8 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">Your GreenCoin Balance</p>
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-civitas-green font-mono">{balance.toFixed(4)}</span>
            <span className="text-xl text-gray-400">GRN</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">≈ {(balance * 0.82).toFixed(2)} kg CO₂ offset · ≈ ₹{(balance * 12).toFixed(0)} value</p>
        </div>
        <div className="w-24 h-24 rounded-full bg-civitas-green/10 border border-civitas-green/30 flex items-center justify-center">
          <Coins size={40} className="text-civitas-green" />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* History */}
        <div className="lg:col-span-2 bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Transaction History</h3>
          <div className="space-y-2">
            {history.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#0A1628] border border-[#1E3A5F]">
                <div>
                  <p className="text-white text-sm font-medium">{r.source}</p>
                  <p className="text-gray-500 text-xs font-mono">{r.date}</p>
                </div>
                <span className={`font-bold font-mono text-sm ${r.type === 'credit' ? 'text-civitas-green' : 'text-red-400'}`}>
                  {r.amount} GRN
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Environmental Impact Stats */}
        <div className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Leaf size={16} className="text-emerald-400" /> Environmental Impact
          </h3>
          <div className="space-y-4">
            <div className="bg-[#0A1628] p-4 rounded-xl border border-emerald-500/10">
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Carbon Offset</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono">{(balance * 0.82).toFixed(2)} kg</p>
              <p className="text-gray-500 text-[10px] mt-1">CO₂ prevented from entering atmosphere</p>
            </div>
            <div className="bg-[#0A1628] p-4 rounded-xl border border-blue-500/10">
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wider">Coal Equivalent</p>
              <p className="text-2xl font-bold text-blue-400 font-mono">{(balance * 0.4).toFixed(2)} kg</p>
              <p className="text-gray-500 text-[10px] mt-1">Hard coal extraction avoided</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace */}
      <div>
        <h3 className="text-white font-semibold mb-4">Redemption Marketplace</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MARKETPLACE.map(item => (
            <div key={item.id} className="bg-[#0F1F3D] border border-[#1E3A5F] rounded-2xl p-5 flex flex-col gap-4 hover:border-civitas-green/40 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bg}`}>
                <span className={item.color}>{item.icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-civitas-gold font-mono font-bold">{item.cost} GRN</span>
                <button
                  onClick={() => handleRedeem(item)}
                  disabled={balance < item.cost}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${redeemed === item.id
                      ? 'bg-civitas-green text-[#0A1628]'
                      : balance >= item.cost
                        ? 'bg-civitas-green/10 text-civitas-green border border-civitas-green/30 hover:bg-civitas-green hover:text-[#0A1628]'
                        : 'bg-gray-700/30 text-gray-600 cursor-not-allowed'}`}>
                  {redeemed === item.id ? '✓ Redeemed' : <>Redeem <ArrowUpRight size={12} /></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

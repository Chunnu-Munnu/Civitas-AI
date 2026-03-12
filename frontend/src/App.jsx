import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, BarChart3, Coins, Database, Settings, ShieldCheck, Zap } from 'lucide-react'

import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Rewards from './pages/Rewards'
import BlockchainVerification from './pages/BlockchainVerification'
import AdminPortal from './pages/AdminPortal'
import Login from './pages/Login'

function ProtectedRoute({ children, user }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

function SidebarLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium
         ${isActive
           ? 'bg-civitas-green/10 text-civitas-green border border-civitas-green/20'
           : 'text-gray-400 hover:text-white hover:bg-white/5'}`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('civitas_user'))

  useEffect(() => {
    const handleStorage = () => {
      setUser(localStorage.getItem('civitas_user'))
    }
    window.addEventListener('storage', handleStorage)
    const interval = setInterval(() => {
        const currentUser = localStorage.getItem('civitas_user')
        if (currentUser !== user) setUser(currentUser)
    }, 1000)
    return () => {
        window.removeEventListener('storage', handleStorage)
        clearInterval(interval)
    }
  }, [user])

  return (
    <Router>
      <div className="flex h-screen bg-[#0A1628] text-white">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute user={user}>
              <div className="flex w-full h-full overflow-hidden">
                {/* Sidebar */}
                <aside className="w-60 flex-shrink-0 border-r border-[#1E3A5F] flex flex-col">
                  {/* Logo */}
                  <div className="px-5 py-6 border-b border-[#1E3A5F]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-civitas-green/20 flex items-center justify-center">
                        <Zap size={16} className="text-civitas-green" />
                      </div>
                      <div>
                        <h1 className="text-white font-bold text-lg leading-none">CIVITAS</h1>
                        <p className="text-gray-500 text-xs mt-0.5">Solar Verification</p>
                      </div>
                    </div>
                  </div>

                  {/* Nav */}
                  <nav className="flex-1 px-3 py-4 space-y-1">
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Monitoring</p>
                    <SidebarLink to="/" icon={<LayoutDashboard size={17} />} label="Live Dashboard" />
                    <SidebarLink to="/analytics" icon={<BarChart3 size={17} />} label="Analytics" />
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-4">Incentives</p>
                    <SidebarLink to="/rewards" icon={<Coins size={17} />} label="GreenCoins" />
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider px-3 mb-2 mt-4">Trust Layer</p>
                    <SidebarLink to="/blockchain" icon={<Database size={17} />} label="Blockchain" />
                    <SidebarLink to="/admin" icon={<Settings size={17} />} label="Admin Portal" />
                  </nav>

                  {/* Footer */}
                  <div className="px-5 py-4 border-t border-[#1E3A5F]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-civitas-green animate-pulse" />
                      <span className="text-gray-400 text-xs">Node Active · v2.4</span>
                    </div>
                  </div>
                </aside>

                {/* Main */}
                <main className="flex-1 overflow-y-auto">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/rewards" element={<Rewards />} />
                    <Route path="/blockchain" element={<BlockchainVerification />} />
                    <Route path="/admin" element={<AdminPortal />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  )
}

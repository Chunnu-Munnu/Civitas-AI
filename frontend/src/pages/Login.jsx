import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Shield, Mail, Lock, Wallet } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    // In demo, we just bypass but store a fake user session
    localStorage.setItem('civitas_user', JSON.stringify({
      email: 'user@visionx.io',
      wallet: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    }))
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center p-4">
      {/* Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-civitas-green/10 blur-[120px]" />

      <div className="w-full max-w-md bg-[#0F1F3D]/80 backdrop-blur-xl border border-[#1E3A5F] rounded-3xl p-8 relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-civitas-green/20 flex items-center justify-center mb-4">
            <Zap size={32} className="text-civitas-green" />
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-wider">CIVITAS</h1>
          <p className="text-gray-400 text-sm mt-1">Solar Fraud Verification Portal</p>
        </div>

        <div className="space-y-6">
          <div className="text-center bg-civitas-green/5 border border-civitas-green/10 p-5 rounded-2xl">
            <p className="text-civitas-green text-sm font-medium">HACKATHON MODE ACTIVE</p>
            <p className="text-gray-400 text-xs mt-1">Single-click entry enabled for judges.</p>
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full bg-civitas-green text-[#0A1628] font-bold py-4 rounded-xl hover:bg-[#00FFBD] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,255,189,0.2)]"
          >
            <Shield size={20} />
            Enter Civitas Portal
          </button>

          <p className="text-center text-gray-500 text-xs">
            Using Demo Wallet: 0xf39...266
          </p>
        </div>
      </div>
    </div>
  )
}

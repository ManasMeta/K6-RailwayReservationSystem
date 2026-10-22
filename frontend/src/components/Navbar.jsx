import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import { formatCurrency } from '../utils/formatters';
import {
  Wallet,
  ArrowUpRight,
  CreditCard,
  QrCode,
  RotateCcw,
  Menu,
  X,
  User,
  Sparkles,
  Wifi,
  ChevronDown,
  Layers,
} from 'lucide-react';

export default function Navbar() {
  const { wallet, loading, isSandbox, toggleSandbox, backendHealth, userId, setUserId } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Wallet },
    { name: 'Top-up UPI', path: '/topup', icon: ArrowUpRight },
    { name: 'Pay Reservation', path: '/pay', icon: CreditCard },
    { name: 'E-Tickets', path: '/tickets', icon: QrCode },
    { name: 'Refunds', path: '/refunds', icon: RotateCcw },
  ];

  const simulatedUsers = [
    { id: '1', name: 'User #1 (Primary Passenger)' },
    { id: '2', name: 'User #2 (Aditya P.)' },
    { id: '42', name: 'User #42 (Integration Test User)' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform duration-200">
              <span className="text-xl">🚆</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  NRRMS
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  G5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                Wallet & Ticketing Portal
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Area */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Balance Pill */}
            <div
              onClick={() => navigate('/topup')}
              className="group cursor-pointer flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-850 transition-all duration-200 shadow-sm"
              title="Click to Top Up Wallet"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <div className="text-left">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                  Balance
                </span>
                <span className="text-sm font-bold text-emerald-400 tracking-tight">
                  {loading ? '...' : formatCurrency(wallet?.balance ?? 0)}
                </span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>

            {/* Sandbox Mode / Live Mode Badge Toggle */}
            <button
              onClick={() => toggleSandbox(!isSandbox)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                isSandbox
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
              }`}
              title={isSandbox ? 'Click to switch to Live Backend' : 'Click to switch to Sandbox Mode'}
            >
              {isSandbox ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sandbox</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Live API</span>
                </>
              )}
            </button>

            {/* User Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                <div className="w-5 h-5 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                  U{userId}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel shadow-2xl py-2 z-50 border border-slate-700 animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setUserDropdownOpen(false)}
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Switch Simulated User
                  </div>
                  {simulatedUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setUserId(u.id);
                        setUserDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                        userId === u.id
                          ? 'bg-blue-600/20 text-blue-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <span>{u.name}</span>
                      {userId === u.id && <span className="text-blue-400 text-xs">Active</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => toggleSandbox(!isSandbox)}
              className={`p-1.5 rounded-lg text-xs border ${
                isSandbox ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {isSandbox ? 'Sandbox' : 'Live'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-t border-slate-800 px-4 pt-3 pb-6 space-y-2">
          {/* Mobile Balance Chip */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-3">
            <div className="text-xs text-slate-400">Current Spendable Balance</div>
            <div className="text-base font-bold text-emerald-400">
              {formatCurrency(wallet?.balance ?? 0)}
            </div>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Simulated User</span>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="1">User #1</option>
              <option value="2">User #2</option>
              <option value="42">User #42</option>
            </select>
          </div>
        </div>
      )}
    </header>
  );
}

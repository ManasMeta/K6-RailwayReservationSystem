import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { Wifi, WifiOff, Terminal, RefreshCw, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export default function ApiStatusBanner() {
  const { isSandbox, toggleSandbox, backendHealth, checkBackend, refreshWallet } = useWallet();
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await checkBackend();
    await refreshWallet();
    setRetrying(false);
  };

  // If live and backend is connected, show nothing or minimal clean indicator
  if (!isSandbox && backendHealth.online && backendHealth.database) {
    return null;
  }

  return (
    <div className="mb-6">
      {isSandbox ? (
        <div className="glass-panel border-amber-500/30 bg-amber-950/20 rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Sparkles className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-200 text-sm">Interactive Sandbox Mode Active</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Offline Simulation
                  </span>
                </div>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Simulating PostgreSQL ledger, UPI top-ups, reservation payments, and e-tickets locally.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                Check Live Backend
              </button>
              <button
                onClick={() => toggleSandbox(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors"
              >
                Switch to Live Mode
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel border-rose-500/30 bg-rose-950/25 rounded-2xl p-4 shadow-lg backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <WifiOff className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-rose-200 text-sm">FastAPI Backend Unreachable</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Live Mode
                  </span>
                </div>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  Cannot connect to <code className="bg-slate-900/80 px-1 py-0.5 rounded text-rose-200">{backendHealth.apiUrl}</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setExpanded(!expanded)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors flex items-center gap-1"
              >
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Command</span>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                Retry
              </button>

              <button
                onClick={() => toggleSandbox(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-glow"
              >
                Switch to Sandbox Mode
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-rose-500/20 text-xs text-slate-300 space-y-2">
              <p>To start the backend with FastAPI and PostgreSQL:</p>
              <div className="bg-slate-950 p-2.5 rounded-xl font-mono text-[11px] text-blue-300 border border-slate-800 overflow-x-auto flex items-center justify-between">
                <span>uvicorn app.main:app --app-dir backend --reload</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Or explore the full frontend features immediately by clicking <strong>"Switch to Sandbox Mode"</strong> above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="text-center py-24 px-4 max-w-lg mx-auto">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-4xl mb-6 shadow-glow">
        🚆
      </div>
      <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
        404 — Station Not Found
      </span>
      <h2 className="text-3xl font-extrabold text-white tracking-tight mt-4">
        Track Terminated
      </h2>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed">
        The railway route or page you are looking for does not exist on the NRRMS portal.
      </p>

      <div className="mt-8 flex justify-center">
        <Link
          to="/"
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-glow transition-all flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Return to Wallet Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

import React from 'react';
import { useWallet } from '../context/WalletContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts, removeToast } = useWallet();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        let Icon = Info;
        let colorClasses = 'border-blue-500/30 bg-slate-900/90 text-blue-300';
        let iconColor = 'text-blue-400';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          colorClasses = 'border-emerald-500/40 bg-slate-900/95 text-emerald-200 shadow-glow-emerald';
          iconColor = 'text-emerald-400';
        } else if (toast.type === 'error') {
          Icon = AlertCircle;
          colorClasses = 'border-rose-500/40 bg-slate-900/95 text-rose-200 shadow-lg';
          iconColor = 'text-rose-400';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          colorClasses = 'border-amber-500/40 bg-slate-900/95 text-amber-200 shadow-lg';
          iconColor = 'text-amber-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 ${colorClasses}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-sm">
              {toast.title && <h4 className="font-semibold text-white tracking-tight">{toast.title}</h4>}
              <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

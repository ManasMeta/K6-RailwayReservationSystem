import React from 'react';

export default function Badge({ variant = 'default', children, className = '' }) {
  const variants = {
    credit: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    debit: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    confirmed: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse',
    completed: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    posted: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    cancelled: 'bg-slate-700/50 text-slate-400 border border-slate-600/50',
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
  };

  const selectedClass = variants[variant.toLowerCase()] || variants.default;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-colors ${selectedClass} ${className}`}
    >
      {children}
    </span>
  );
}

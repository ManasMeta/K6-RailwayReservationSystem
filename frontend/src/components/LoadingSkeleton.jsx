import React from 'react';

export function CardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-28 bg-slate-800 rounded"></div>
        <div className="h-8 w-8 bg-slate-800 rounded-full"></div>
      </div>
      <div className="h-8 w-44 bg-slate-800 rounded mb-3"></div>
      <div className="h-3 w-32 bg-slate-800/60 rounded"></div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800"></div>
            <div className="space-y-2">
              <div className="h-4 w-36 bg-slate-800 rounded"></div>
              <div className="h-3 w-24 bg-slate-800/60 rounded"></div>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="h-4 w-20 bg-slate-800 rounded ml-auto"></div>
            <div className="h-3 w-16 bg-slate-800/60 rounded ml-auto"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = 'card', rows = 5 }) {
  if (type === 'table') return <TableSkeleton rows={rows} />;
  return <CardSkeleton />;
}

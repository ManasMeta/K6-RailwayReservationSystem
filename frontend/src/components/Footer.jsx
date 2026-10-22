import React from 'react';
import { ShieldCheck, Database, Server, Code2, Train } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-md py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-slate-200">
              <span className="text-xl">🚆</span>
              <span className="font-bold text-sm tracking-tight text-white">NRRMS — Group G5</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Wallet & Ticketing
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-md">
              High-reliability railway digital wallet, instant simulated UPI funding with idempotency protection,
              atomic reservation payment, e-ticket generation with QR codes and PDF boarding passes, and cancellation refunds.
            </p>
            <div className="flex items-center gap-3 pt-2 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-blue-400" /> PostgreSQL 16
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-emerald-400" /> FastAPI
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" /> React + Vite
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3 tracking-wider uppercase text-[11px]">
              Module Team (G5)
            </h4>
            <ul className="space-y-2 text-slate-400 text-xs">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                <span><strong>Mangesh:</strong> Frontend & UI Architecture</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span><strong>Aditya:</strong> FastAPI & Ticket PDF/QR</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span><strong>Aditya Patil:</strong> SQL Ledger & Migrations</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3 tracking-wider uppercase text-[11px]">
              Financial Integrity
            </h4>
            <ul className="space-y-1.5 text-slate-400 text-[11px]">
              <li>• Double-Entry Audited Ledger</li>
              <li>• NUMERIC(10,2) Zero Float Money</li>
              <li>• Strict Idempotency-Key Headers</li>
              <li>• Row Locking via SELECT FOR UPDATE</li>
              <li>• Dynamic Cancellation Refund Tiers</li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            National Railway Reservation and Management System (NRRMS) • Group 5 Subsystem
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Audited Double-Entry Balance Enforced</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

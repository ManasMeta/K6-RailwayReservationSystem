import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import Badge from '../components/Badge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import {
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';

export default function RefundsPage() {
  const { isSandbox, showToast } = useWallet();
  const [refunds, setRefunds] = useState([]);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 10;

  // Refund policy calculator tool
  const [calcFare, setCalcFare] = useState('1200');
  const [calcHours, setCalcHours] = useState('50');
  const [calcRailwayCancelled, setCalcRailwayCancelled] = useState(false);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      if (isSandbox) {
        const res = sandboxStore.getRefunds(limit, page * limit);
        setRefunds(res.items || []);
        setTotalRefunds(res.total || 0);
      } else {
        const res = await walletService.getRefunds(limit, page * limit);
        setRefunds(res.items || []);
        setTotalRefunds(res.total || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch refunds:', err);
    } finally {
      setLoading(false);
    }
  }, [isSandbox, page, limit]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Calculate estimated refund using 0511_refund_rules.sql logic
  const calculateRefund = (fare, hours, railwayCancelled) => {
    const f = parseFloat(fare) || 0;
    if (railwayCancelled) return { percent: 100, amount: f };
    const h = parseFloat(hours) || 0;
    if (h >= 48) return { percent: 90, amount: f * 0.90 };
    if (h >= 12) return { percent: 75, amount: f * 0.75 };
    if (h >= 4) return { percent: 50, amount: f * 0.50 };
    return { percent: 0, amount: 0 };
  };

  const calculated = calculateRefund(calcFare, calcHours, calcRailwayCancelled);
  const totalPages = Math.ceil(totalRefunds / limit) || 1;

  const refundPolicies = [
    { tier: '> 48 Hours', percent: '90%', desc: 'Voluntary passenger cancellation well in advance' },
    { tier: '12 – 48 Hours', percent: '75%', desc: 'Cancellation between 12 to 48 hours before train departure' },
    { tier: '4 – 12 Hours', percent: '50%', desc: 'Last minute cancellation between 4 to 12 hours' },
    { tier: '< 4 Hours', percent: '0%', desc: 'No refund permissible within 4 hours of departure' },
    { tier: 'Railway Cancelled', percent: '100%', desc: 'Full refund if train run cancelled by Indian Railways' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
          <RotateCcw className="w-4 h-4" />
          <span>Automated Ledger Reversals</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Refund History & Rules
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          View automated cancellation refunds credited back to your wallet under NRRMS financial rules.
        </p>
      </div>

      {/* Policy Explainer Cards & Interactive Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Policy Tiers Breakdown */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Official Cancellation Refund Policy (0511_refund_rules)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              G5 Ledger Trigger
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            When a reservation is cancelled via Group 4, trigger <code>fn_create_refund_on_cancellation()</code> computes
            the refund percentage and posts a balanced double-entry credit straight to your wallet.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {refundPolicies.map((p, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{p.tier}</span>
                  <span
                    className={`text-sm font-black font-mono ${
                      p.percent === '100%' || p.percent === '90%'
                        ? 'text-emerald-400'
                        : p.percent === '0%'
                        ? 'text-slate-500'
                        : 'text-amber-400'
                    }`}
                  >
                    {p.percent}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Refund Simulator */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-xs font-bold text-slate-200 uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-blue-400" />
              <span>Refund Estimator</span>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] uppercase font-semibold mb-1">
                  Ticket Fare (INR)
                </label>
                <input
                  type="number"
                  value={calcFare}
                  onChange={(e) => setCalcFare(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] uppercase font-semibold mb-1">
                  Hours Before Departure
                </label>
                <input
                  type="number"
                  value={calcHours}
                  disabled={calcRailwayCancelled}
                  onChange={(e) => setCalcHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500 disabled:opacity-40"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="railwayCancelled"
                  checked={calcRailwayCancelled}
                  onChange={(e) => setCalcRailwayCancelled(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="railwayCancelled" className="text-slate-300 text-xs cursor-pointer">
                  Railway cancelled train run (100% full)
                </label>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 mt-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Refund Eligibility:</span>
              <span className="font-bold text-white">{calculated.percent}%</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-slate-400">Estimated Return:</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                {formatCurrency(calculated.amount)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Refunds History Table */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800/80">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Your Refund Records</span>
              <span className="text-xs font-normal text-slate-400">
                ({totalRefunds} total refunds)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct wallet balance credits processed via database cancellation triggers.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <LoadingSkeleton type="table" rows={4} />
          ) : refunds.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <RotateCcw className="w-8 h-8" />
              </div>
              <h4 className="text-base font-semibold text-slate-300">No Refunds on Record</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                You have not received any cancellation refunds yet. When a reservation is cancelled via G4, refunds are posted here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Refund ID</th>
                    <th className="py-3 px-3">PNR</th>
                    <th className="py-3 px-3">Reason / Policy Tier</th>
                    <th className="py-3 px-3 text-right">Amount Credited</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                  {refunds.map((r) => (
                    <tr
                      key={r.refund_id}
                      className="hover:bg-slate-900/60 transition-colors"
                    >
                      <td className="py-4 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="py-4 px-3 font-mono text-slate-300 font-medium">
                        #{r.refund_id}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-blue-300">
                        {r.pnr}
                      </td>
                      <td className="py-4 px-3 text-slate-300 max-w-xs">
                        {r.reason || 'Reservation cancellation refund'}
                      </td>
                      <td className="py-4 px-3 text-right font-mono font-bold text-emerald-400 text-sm whitespace-nowrap">
                        +{formatCurrency(r.amount)}
                      </td>
                      <td className="py-4 px-3 text-center whitespace-nowrap">
                        <Badge variant="completed">{r.status || 'COMPLETED'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalRefunds > limit && (
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Page <span className="font-bold text-white">{page + 1}</span> of{' '}
                <span className="font-bold text-white">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

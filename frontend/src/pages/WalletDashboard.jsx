import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';
import { formatCurrency, formatDateTime, copyToClipboard } from '../utils/formatters';
import Badge from '../components/Badge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  RotateCcw,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  FileText,
  Clock,
  Search,
  Filter,
} from 'lucide-react';

export default function WalletDashboard() {
  const { wallet, loading: walletLoading, refreshWallet, isSandbox, showToast } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [totalTxns, setTotalTxns] = useState(0);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, TOPUP, PAYMENT, REFUND

  // Pagination state
  const [page, setPage] = useState(0);
  const limit = 10;
  const navigate = useNavigate();

  const fetchTransactions = useCallback(async () => {
    setLoadingTxns(true);
    try {
      if (isSandbox) {
        const res = sandboxStore.getTransactions(limit, page * limit);
        setTransactions(res.items || []);
        setTotalTxns(res.total || 0);
      } else {
        const res = await walletService.getTransactions(limit, page * limit);
        setTransactions(res.items || []);
        setTotalTxns(res.total || 0);
      }
    } catch (err) {
      console.warn('Failed to load transactions:', err);
      // In live mode, error is reported via context toast
    } finally {
      setLoadingTxns(false);
    }
  }, [isSandbox, page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, wallet?.balance]);

  const handleCopy = async (text, id) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast({ type: 'info', title: 'Copied to Clipboard', message: text });
    }
  };

  // Filter items in UI for search term and type
  const filteredTransactions = transactions.filter((t) => {
    const matchesType = filterType === 'ALL' || t.type === filterType;
    const matchesSearch =
      searchTerm === '' ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.reference_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.ledger_txn_id).includes(searchTerm);
    return matchesType && matchesSearch;
  });

  // Calculate summary statistics
  const totalCredits = transactions
    .filter((t) => t.direction === 'CREDIT')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalDebits = transactions
    .filter((t) => t.direction === 'DEBIT')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalPages = Math.ceil(totalTxns / limit) || 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner / Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Main Wallet Digital Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border border-blue-500/30 shadow-2xl">
          {/* Background decorative railway track line */}
          <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
          <div className="absolute right-6 top-6 opacity-10 text-white font-mono text-8xl font-black select-none pointer-events-none">
            G5
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚆</span>
                  <div>
                    <h3 className="font-bold text-white tracking-wide text-sm sm:text-base">
                      NRRMS Railway Digital Wallet
                    </h3>
                    <p className="text-[11px] text-blue-200/70 font-mono">
                      Wallet ID: #{wallet?.wallet_id || '101'} • User: #{wallet?.user_id || '1'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    refreshWallet();
                    fetchTransactions();
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
                  title="Refresh Balance"
                >
                  <RefreshCw className={`w-4 h-4 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Large Balance Display */}
              <div className="mt-8">
                <span className="text-xs uppercase font-semibold text-blue-300/80 tracking-wider">
                  Available Spendable Balance
                </span>
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-1 flex items-baseline gap-2">
                  <span>{walletLoading ? '₹ ...' : formatCurrency(wallet?.balance ?? 0)}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {wallet?.currency || 'INR'}
                  </span>
                </div>
                <p className="text-xs text-blue-200/60 mt-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Last updated: {wallet?.updated_at ? formatDateTime(wallet.updated_at) : 'Just now'}</span>
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-3">
              <Link
                to="/topup"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm shadow-glow transition-all duration-200 active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Top-up UPI</span>
              </Link>

              <Link
                to="/pay"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-md border border-white/20 transition-all duration-200 active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Reservation</span>
              </Link>

              <Link
                to="/tickets"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 text-slate-200 text-sm font-medium border border-slate-700/60 transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">My Tickets</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Insights / Ledger Health Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h4 className="font-semibold text-slate-200 text-sm tracking-wide">
                Account Summary
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Audited
              </span>
            </div>

            <div className="space-y-4 mt-5">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Total Credits</div>
                    <div className="text-sm font-bold text-emerald-400">{formatCurrency(totalCredits)}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500">Inflow</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Total Debits</div>
                    <div className="text-sm font-bold text-rose-400">{formatCurrency(totalDebits)}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500">Outflow</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Total Transactions</div>
                    <div className="text-sm font-bold text-indigo-300">{totalTxns} Recorded</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500">Statement</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>View <code>v_wallet_statement</code> running balance</span>
          </div>
        </div>

      </div>

      {/* Transaction Statement Section */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Wallet Statement & Ledger Entries</span>
              <span className="text-xs font-normal text-slate-400">
                ({totalTxns} total events)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological financial statement with balanced double-entry running balance.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, PNR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
              {['ALL', 'TOPUP', 'PAYMENT', 'REFUND'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === f
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions Table / List */}
        <div className="mt-6">
          {loadingTxns ? (
            <LoadingSkeleton type="table" rows={5} />
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
                <Wallet className="w-8 h-8" />
              </div>
              <h4 className="text-base font-semibold text-slate-300">No Transactions Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchTerm || filterType !== 'ALL'
                  ? 'No records match your search or filter criteria.'
                  : 'Your wallet has no recorded financial transactions yet. Top up your wallet to get started!'}
              </p>
              {searchTerm === '' && filterType === 'ALL' && (
                <Link
                  to="/topup"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Top-up Wallet Now</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Description / Ref</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-right">Balance After</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                  {filteredTransactions.map((t) => {
                    const isCredit = t.direction === 'CREDIT';
                    return (
                      <tr
                        key={t.ledger_txn_id}
                        className="hover:bg-slate-900/60 transition-colors group"
                      >
                        {/* Timestamp */}
                        <td className="py-4 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                          {formatDateTime(t.created_at)}
                        </td>

                        {/* Type Badge */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <Badge variant={t.type}>{t.type}</Badge>
                        </td>

                        {/* Description & Reference */}
                        <td className="py-4 px-3">
                          <div className="font-medium text-slate-200">{t.description}</div>
                          {t.reference_id && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span>Ref:</span>
                              <span className="font-mono text-blue-300">{t.reference_id}</span>
                              <button
                                onClick={() => handleCopy(t.reference_id, t.ledger_txn_id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity"
                                title="Copy Reference"
                              >
                                {copiedId === t.ledger_txn_id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {t.type === 'PAYMENT' && (
                                <Link
                                  to={`/tickets/${t.reference_id}`}
                                  className="text-blue-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                                >
                                  <span>Ticket</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </Link>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Direction & Amount */}
                        <td className="py-4 px-3 text-right whitespace-nowrap">
                          <span
                            className={`font-bold font-mono text-sm ${
                              isCredit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isCredit ? '+' : '-'} {formatCurrency(t.amount)}
                          </span>
                        </td>

                        {/* Running Balance */}
                        <td className="py-4 px-3 text-right whitespace-nowrap font-mono text-slate-300 font-semibold">
                          {formatCurrency(t.balance_after)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-3 text-center whitespace-nowrap">
                          <Badge variant="posted">{t.status || 'POSTED'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalTxns > limit && (
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing page <span className="font-bold text-white">{page + 1}</span> of{' '}
                <span className="font-bold text-white">{totalPages}</span> ({totalTxns} records)
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loadingTxns}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loadingTxns}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
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

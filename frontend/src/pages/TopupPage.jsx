import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';
import {
  formatCurrency,
  generateIdempotencyKey,
  copyToClipboard,
} from '../utils/formatters';
import {
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Smartphone,
  CreditCard,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react';

export default function TopupPage() {
  const { wallet, refreshWallet, isSandbox, showToast } = useWallet();
  const navigate = useNavigate();

  // Form states
  const [amount, setAmount] = useState('500');
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey('topup'));
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [customVpa, setCustomVpa] = useState('passenger@upi');
  const [copiedKey, setCopiedKey] = useState(false);

  // Submission & simulation states
  const [submitting, setSubmitting] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiTimer, setUpiTimer] = useState(60);
  const [topupResult, setTopupResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const presetAmounts = ['100', '250', '500', '1000', '2000', '5000'];

  const upiApps = [
    { id: 'gpay', name: 'Google Pay', icon: '⚡', color: 'from-blue-600 to-indigo-600' },
    { id: 'phonepe', name: 'PhonePe', icon: '🟣', color: 'from-purple-600 to-indigo-700' },
    { id: 'paytm', name: 'Paytm UPI', icon: '🔵', color: 'from-cyan-600 to-blue-700' },
    { id: 'bhim', name: 'BHIM UPI', icon: '🇮🇳', color: 'from-emerald-600 to-teal-700' },
  ];

  // Refresh idempotency key
  const handleRegenerateKey = () => {
    const newKey = generateIdempotencyKey('topup');
    setIdempotencyKey(newKey);
    showToast({ type: 'info', title: 'New Idempotency-Key Generated', message: newKey });
  };

  const handleCopyKey = async () => {
    const ok = await copyToClipboard(idempotencyKey);
    if (ok) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      showToast({ type: 'info', title: 'Key Copied', message: idempotencyKey });
    }
  };

  // Launch Simulated UPI Modal
  const handleInitiateTopup = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Please enter an amount greater than ₹0.00');
      return;
    }
    if (num > 99999999.99) {
      setErrorMessage('Amount exceeds maximum allowed limit (₹99,999,999.99)');
      return;
    }
    setErrorMessage(null);
    setUpiTimer(60);
    setShowUpiModal(true);
  };

  // Execute the real or sandbox topup
  const handleConfirmUpiPayment = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      let res;
      if (isSandbox) {
        res = sandboxStore.createTopup(amount, idempotencyKey);
      } else {
        res = await walletService.createTopup(amount, idempotencyKey);
      }

      setTopupResult(res);
      setShowUpiModal(false);
      refreshWallet();

      showToast({
        type: 'success',
        title: res.replayed ? 'Top-up Replayed' : 'Top-up Successful!',
        message: `${formatCurrency(res.amount)} credited to your wallet. Ref: ${res.provider_reference}`,
      });
    } catch (err) {
      console.error('Top-up failed:', err);
      setErrorMessage(err.message || 'Top-up could not be completed');
      showToast({
        type: 'error',
        title: 'Top-up Failed',
        message: err.message || 'Payment simulation failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
          <Zap className="w-4 h-4" />
          <span>Simulated Instant UPI Payment</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Top-up Digital Wallet
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Add spendable funds to your railway wallet with strict double-entry ledger idempotency protection.
        </p>
      </div>

      {topupResult ? (
        /* Top-up Success Screen */
        <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-5 shadow-glow-emerald">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {topupResult.replayed ? 'Idempotent Replay' : 'Transaction Completed'}
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-white mt-3">
              {formatCurrency(topupResult.amount)} Credited
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Your wallet balance has been updated to{' '}
              <strong className="text-emerald-400 font-mono text-sm">
                {formatCurrency(topupResult.balance)}
              </strong>
            </p>

            {/* Receipt Summary Card */}
            <div className="mt-8 p-5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2.5">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono text-blue-300 font-semibold">
                  {topupResult.provider_reference}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Top-up ID:</span>
                <span className="font-mono text-slate-200">#{topupResult.topup_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Idempotency Key:</span>
                <span className="font-mono text-slate-400 text-[11px] truncate max-w-[220px]">
                  {idempotencyKey}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Execution Type:</span>
                <span className="text-emerald-400 font-medium">
                  {topupResult.simulated ? 'Simulated UPI Mock' : 'Live Gateway'}
                </span>
              </div>
            </div>

            {/* Next actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/pay"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay a Reservation</span>
              </Link>

              <Link
                to="/"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>View Statement</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                onClick={() => {
                  setTopupResult(null);
                  handleRegenerateKey();
                }}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white text-xs font-medium border border-slate-800 transition-colors"
              >
                Top-up Again
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Top-up Form */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Top-up Amount Form */}
          <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6">
            <form onSubmit={handleInitiateTopup} className="space-y-6">
              
              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select or Enter Amount (INR)
                </label>

                {/* Amount Input with INR Badge */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-xl font-bold text-slate-400">
                    ₹
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    max="99999999"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="Enter amount"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-2xl font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                {/* Preset Amount Chips */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                  {presetAmounts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        amount === p
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      +{formatCurrency(p)}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI App Selection Simulator */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Choose Simulated UPI Method
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {upiApps.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedUpiApp(app.id)}
                      className={`cursor-pointer p-3 rounded-2xl border transition-all duration-200 flex flex-col items-center text-center ${
                        selectedUpiApp === app.id
                          ? 'bg-blue-600/15 border-blue-500/60 shadow-glow'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-2xl mb-1">{app.icon}</span>
                      <span className="text-xs font-bold text-white">{app.name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Instant Mock</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-semibold block">Top-up Notice</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-glow transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <ArrowUpRight className="w-5 h-5" />
                <span>Simulate UPI Top-up of {formatCurrency(amount || 0)}</span>
              </button>
            </form>
          </div>

          {/* Idempotency & Financial Safety Sidebar */}
          <div className="space-y-6">
            
            {/* Idempotency Card */}
            <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Idempotency Protection</span>
                </div>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Generate new key"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Prevents double-charging if connection drops. Backend stores this key in the <code>topups</code> table and rejects duplicate debits.
              </p>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Active Idempotency-Key
                </span>
                <div className="mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono text-blue-300">
                  <span className="truncate pr-2">{idempotencyKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                  <span>Generate New Key</span>
                </button>
              </div>
            </div>

            {/* Current Wallet Balance Status Card */}
            <div className="glass-panel rounded-3xl p-6 border border-slate-800">
              <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Current Spendable Balance
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {formatCurrency(wallet?.balance ?? 0)}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div>• Zero transaction fees on UPI wallet load</div>
                <div>• Instant availability for train ticket payment</div>
                <div>• Automated refunds credited directly back</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Simulated UPI Authorization Modal */}
      {showUpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl relative animate-in zoom-in-95">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-4">
                <Smartphone className="w-7 h-7" />
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight">
                Simulated UPI Authorization
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                App: <span className="text-white font-medium capitalize">{selectedUpiApp}</span> • Merchant: NRRMS Railway Clearing
              </p>

              {/* Amount Display */}
              <div className="my-6 p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs uppercase font-semibold text-slate-400">Total Amount</span>
                <div className="text-3xl font-black text-white font-mono mt-0.5">
                  {formatCurrency(amount)}
                </div>
              </div>

              {/* Simulated QR Code placeholder */}
              <div className="p-4 rounded-2xl bg-white w-44 h-44 mx-auto flex flex-col items-center justify-center shadow-md">
                <QrCode className="w-32 h-32 text-slate-900" />
                <span className="text-[9px] font-mono font-bold text-slate-700 mt-1">SCAN WITH UPI APP</span>
              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                Simulating UPI intent callback. Click authorize to complete mock deposit.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpiPayment}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Posting Ledger...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Authorize Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

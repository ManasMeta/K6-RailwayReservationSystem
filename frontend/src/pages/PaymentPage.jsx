import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';
import {
  formatCurrency,
  formatDateTime,
  generateIdempotencyKey,
  isValidPNR,
  copyToClipboard,
} from '../utils/formatters';
import Badge from '../components/Badge';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  QrCode,
  Download,
  ShieldCheck,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  FileText,
  Train,
  Check,
  Copy,
} from 'lucide-react';

export default function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wallet, refreshWallet, isSandbox, showToast } = useWallet();

  // Initial PNR from query param or default empty
  const [pnrInput, setPnrInput] = useState(() => searchParams.get('pnr') || '');
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState(null);

  // Payment execution state
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey('pay'));
  const [copiedPnr, setCopiedPnr] = useState(false);

  // Quick test demo PNR suggestions (from G4 / sandbox)
  const samplePnrs = [
    { pnr: 'PNR8941203', fare: 450.00, train: 'Vande Bharat' },
    { pnr: 'PNR1029384', fare: 1050.00, train: 'Rajdhani' },
    { pnr: 'PNR7765219', fare: 3200.00, train: 'Tejas Superfast' },
  ];

  // Auto-fetch quote if PNR is provided in URL
  useEffect(() => {
    const queryPnr = searchParams.get('pnr');
    if (queryPnr && isValidPNR(queryPnr)) {
      handleFetchQuote(queryPnr);
    }
  }, [searchParams]);

  const handleFetchQuote = async (targetPnr) => {
    const pnr = (targetPnr || pnrInput).trim().toUpperCase();
    if (!isValidPNR(pnr)) {
      setQuoteError('Please enter a valid alphanumeric PNR (1-20 characters)');
      setQuote(null);
      return;
    }

    setLoadingQuote(true);
    setQuoteError(null);
    setQuote(null);
    setPaymentResult(null);
    setPaymentError(null);

    try {
      let data;
      if (isSandbox) {
        data = sandboxStore.getPaymentQuote(pnr);
      } else {
        data = await walletService.getPaymentQuote(pnr);
      }
      setQuote(data);
      setPnrInput(pnr);
    } catch (err) {
      console.warn('Quote fetch failed:', err);
      setQuoteError(err.message || `Reservation ${pnr} was not found or is not accessible.`);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!quote || !quote.pnr) return;

    setSubmittingPayment(true);
    setPaymentError(null);

    try {
      let res;
      if (isSandbox) {
        res = sandboxStore.payReservation(quote.pnr, idempotencyKey);
      } else {
        res = await walletService.payReservation(quote.pnr, idempotencyKey);
      }

      setPaymentResult(res);
      refreshWallet();

      showToast({
        type: 'success',
        title: res.replayed ? 'Payment Replayed' : 'Payment Confirmed!',
        message: `Reservation ${res.pnr} paid. Ticket: ${res.ticket_number}`,
      });
    } catch (err) {
      console.error('Payment failed:', err);
      setPaymentError(err.message || 'Payment failed');
      showToast({
        type: 'error',
        title: 'Payment Failed',
        message: err.message || 'Payment could not be processed',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCopy = async (text) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedPnr(true);
      setTimeout(() => setCopiedPnr(false), 2000);
      showToast({ type: 'info', title: 'Copied to Clipboard', message: text });
    }
  };

  const currentBalance = parseFloat(wallet?.balance ?? quote?.balance ?? 0);
  const fareAmount = quote ? parseFloat(quote.amount || 0) : 0;
  const hasSufficientFunds = currentBalance >= fareAmount;
  const deficitAmount = Math.max(0, fareAmount - currentBalance);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
          <CreditCard className="w-4 h-4" />
          <span>Atomic Wallet Payment</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Pay Railway Reservation
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Fetch reservation fare quotes from G4, verify wallet balance, and confirm ticket payment atomically.
        </p>
      </div>

      {paymentResult ? (
        /* Payment Success Screen */
        <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900/95 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="text-center max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-5 shadow-glow-emerald">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {paymentResult.replayed ? 'Idempotent Payment Replayed' : 'Ticket Issued & Confirmed'}
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-white mt-3">
              Payment Successful!
            </h3>

            <p className="text-xs text-slate-400 mt-1">
              Fare of <strong className="text-white font-mono text-sm">{formatCurrency(paymentResult.amount)}</strong> was deducted from your wallet.
            </p>

            {/* Receipt Summary Card */}
            <div className="mt-8 p-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-left text-xs space-y-3">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">PNR:</span>
                <span className="font-mono text-blue-300 font-bold text-sm">
                  {paymentResult.pnr}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">E-Ticket Number:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {paymentResult.ticket_number}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Payment ID:</span>
                <span className="font-mono text-slate-200">#{paymentResult.payment_id}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Updated Wallet Balance:</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  {formatCurrency(paymentResult.balance)}
                </span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={`/tickets/${paymentResult.pnr}`}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-glow transition-all flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>View E-Ticket & QR Code</span>
              </Link>

              <Link
                to="/"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs sm:text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>Wallet Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* PNR Lookup & Payment Step */
        <div className="space-y-6">
          
          {/* Step 1: PNR Lookup Bar */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Step 1: Enter Reservation PNR
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFetchQuote(pnrInput);
              }}
              className="flex flex-col sm:flex-row items-stretch gap-3"
            >
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. PNR8941203"
                  value={pnrInput}
                  onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-base font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loadingQuote}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingQuote ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Checking Fare...</span>
                  </>
                ) : (
                  <>
                    <span>Check Fare Quote</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo PNR Suggestions */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-500">Quick Test PNRs:</span>
              {samplePnrs.map((item) => (
                <button
                  key={item.pnr}
                  type="button"
                  onClick={() => {
                    setPnrInput(item.pnr);
                    handleFetchQuote(item.pnr);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-850 text-blue-300 font-mono text-[11px] transition-colors flex items-center gap-1.5"
                >
                  <span>{item.pnr}</span>
                  <span className="text-slate-500">({formatCurrency(item.fare)})</span>
                </button>
              ))}
            </div>

            {/* Quote Lookup Error */}
            {quoteError && (
              <div className="mt-4 p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <span className="font-semibold block">Reservation Notice</span>
                  <span>{quoteError}</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Fare Quote & Payment Confirmation */}
          {quote && (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-700 bg-slate-900/60 space-y-6 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-blue-400">
                    Step 2: Review Fare & Wallet Balance
                  </span>
                  <h3 className="text-xl font-bold text-white mt-0.5">
                    Reservation {quote.pnr}
                  </h3>
                </div>

                <Badge variant={quote.payable ? 'pending' : 'completed'}>
                  {quote.status}
                </Badge>
              </div>

              {/* Quote Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Total Fare Card */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">
                    Total Fare (G4)
                  </span>
                  <div className="text-2xl font-black text-white font-mono mt-1">
                    {formatCurrency(quote.amount)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Fixed ticket fare
                  </span>
                </div>

                {/* Available Balance Card */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">
                    Your Wallet Balance
                  </span>
                  <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                    {formatCurrency(currentBalance)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Spendable balance
                  </span>
                </div>

                {/* Remaining Balance or Deficit */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">
                    {hasSufficientFunds ? 'Balance After Payment' : 'Shortfall Deficit'}
                  </span>
                  <div
                    className={`text-2xl font-black font-mono mt-1 ${
                      hasSufficientFunds ? 'text-blue-300' : 'text-rose-400'
                    }`}
                  >
                    {hasSufficientFunds
                      ? formatCurrency(currentBalance - fareAmount)
                      : `- ${formatCurrency(deficitAmount)}`}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {hasSufficientFunds ? 'Net available funds' : 'Immediate top-up required'}
                  </span>
                </div>

              </div>

              {/* Train and journey information if present */}
              {quote.train_name && (
                <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <Train className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="font-semibold text-slate-200">{quote.train_name}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {quote.from_station} → {quote.to_station}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    {formatDateTime(quote.departure_at)}
                  </div>
                </div>
              )}

              {/* Insufficient Funds Warning & 1-Click Top-up CTA */}
              {!hasSufficientFunds && (
                <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-white">Insufficient Wallet Balance</h4>
                      <p className="mt-0.5 text-amber-300/80 leading-relaxed">
                        Your current balance of {formatCurrency(currentBalance)} is not enough to cover the reservation fare of {formatCurrency(fareAmount)}.
                        Please top up at least <strong className="text-white font-mono">{formatCurrency(deficitAmount)}</strong> to complete payment.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Link
                      to={`/topup?amount=${Math.ceil(deficitAmount)}`}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Top-up Needed Amount ({formatCurrency(deficitAmount)})</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Non-payable notice if reservation already confirmed */}
              {!quote.payable && (
                <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Reservation is already {quote.status}</span>
                    <span className="text-slate-300">
                      This reservation is not waiting for payment. You can inspect its e-ticket or boarding pass.
                    </span>
                  </div>
                  <Link
                    to={`/tickets/${quote.pnr}`}
                    className="ml-auto px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs whitespace-nowrap"
                  >
                    View E-Ticket
                  </Link>
                </div>
              )}

              {/* Payment Error */}
              {paymentError && (
                <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-semibold block">Payment Execution Notice</span>
                    <span>{paymentError}</span>
                  </div>
                </div>
              )}

              {/* Final Confirm Payment Button */}
              {quote.payable && (
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Atomic transaction locks wallet row with <code>SELECT ... FOR UPDATE</code>.
                  </div>

                  <button
                    type="button"
                    onClick={handleExecutePayment}
                    disabled={!hasSufficientFunds || submittingPayment}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-glow-emerald transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {submittingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Atomic Payment...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Confirm & Pay {formatCurrency(quote.amount)}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}

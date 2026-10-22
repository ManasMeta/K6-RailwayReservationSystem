import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';
import {
  formatCurrency,
  formatDateTime,
  isValidPNR,
  copyToClipboard,
} from '../utils/formatters';
import {
  QrCode,
  Download,
  Printer,
  Share2,
  Copy,
  Check,
  Search,
  AlertCircle,
  FileText,
  Train,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export default function TicketDetailsPage() {
  const { pnr: routePnr } = useParams();
  const navigate = useNavigate();
  const { isSandbox, showToast } = useWallet();

  const [searchPnr, setSearchPnr] = useState(routePnr || 'PNR4490128');
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedPnr, setCopiedPnr] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Available sample tickets for quick inspection
  const sampleTickets = ['PNR4490128', 'PNR8941203', 'PNR1029384'];

  const fetchTicket = async (targetPnr) => {
    const pnr = (targetPnr || searchPnr).trim().toUpperCase();
    if (!isValidPNR(pnr)) {
      setError('Please enter a valid alphanumeric PNR');
      setTicket(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let data;
      if (isSandbox) {
        data = sandboxStore.getTicket(pnr);
      } else {
        data = await walletService.getTicket(pnr);
      }
      setTicket(data);
      setSearchPnr(pnr);
    } catch (err) {
      console.warn('Ticket fetch failed:', err);
      setError(err.message || `No e-ticket found for PNR ${pnr}. Make sure payment was completed.`);
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routePnr) {
      fetchTicket(routePnr);
    } else {
      fetchTicket(searchPnr);
    }
  }, [routePnr]);

  const handleCopy = async (text) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedPnr(true);
      setTimeout(() => setCopiedPnr(false), 2000);
      showToast({ type: 'info', title: 'Copied', message: text });
    }
  };

  const handleDownloadPdf = async () => {
    if (!ticket) return;
    setDownloadingPdf(true);
    try {
      if (isSandbox) {
        // In sandbox mode, generate a downloadable ticket text/receipt blob
        const content = `NRRMS E-TICKET RECEIPT\nPNR: ${ticket.pnr}\nTicket No: ${ticket.ticket_number}\nAmount: ${formatCurrency(ticket.amount)}\nIssued: ${formatDateTime(ticket.issued_at)}\nPayment: Paid from NRRMS Wallet\nValid with official Photo ID.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-${ticket.pnr}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const blob = await walletService.downloadTicketPdf(ticket.pnr);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-${ticket.pnr}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      showToast({
        type: 'success',
        title: 'Download Complete',
        message: `Saved ticket-${ticket.pnr}`,
      });
    } catch (err) {
      console.error('PDF download error:', err);
      showToast({
        type: 'error',
        title: 'Download Failed',
        message: err.message || 'Could not download ticket PDF',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const qrImageUrl = ticket
    ? isSandbox
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
          ticket.qr_payload || `NRRMS:${ticket.pnr}:${ticket.ticket_number}`
        )}`
      : walletService.getTicketQrUrl(ticket.pnr)
    : '';

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
            <QrCode className="w-4 h-4" />
            <span>Digital Boarding Pass</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            E-Ticket & QR Verification
          </h2>
        </div>

        {/* Search Bar for Other PNRs */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTicket(searchPnr);
          }}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <div className="relative flex-1 sm:w-52">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search PNR..."
              value={searchPnr}
              onChange={(e) => setSearchPnr(e.target.value.toUpperCase())}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 uppercase focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-colors flex items-center gap-1"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lookup</span>
          </button>
        </form>
      </div>

      {/* Quick Switcher for Demo Tickets */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="text-slate-500 font-semibold">Sample Issued Tickets:</span>
        {sampleTickets.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => {
              setSearchPnr(sample);
              fetchTicket(sample);
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono border transition-all ${
              searchPnr === sample && ticket
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 font-bold'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            {sample}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-800 animate-pulse">
          <RefreshCw className="w-8 h-8 mx-auto text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-slate-300">Retrieving E-Ticket & station QR...</p>
        </div>
      ) : error ? (
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">No E-Ticket Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to={`/pay?pnr=${searchPnr}`}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-colors flex items-center gap-1.5"
            >
              <span>Pay Reservation {searchPnr}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : ticket ? (
        <div className="space-y-6">
          
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-300">Valid Confirmed Ticket</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-colors flex items-center gap-1.5"
                title="Print ticket"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span>Print</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-glow transition-all flex items-center gap-1.5"
              >
                <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-bounce' : ''}`} />
                <span>{downloadingPdf ? 'Preparing...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* Authentic Railway Boarding Pass / E-Ticket Card */}
          <div className="relative rounded-3xl bg-slate-900/95 border border-slate-700/80 overflow-hidden shadow-2xl">
            
            {/* Scalloped notches for authentic boarding pass ticket aesthetic */}
            <div className="ticket-notch-left hidden sm:block"></div>
            <div className="ticket-notch-right hidden sm:block"></div>

            {/* Ticket Header Banner */}
            <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 sm:p-8 border-b border-slate-800 relative">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-glow">
                    🚆
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      NRRMS E-Ticket
                    </h3>
                    <p className="text-xs text-blue-300/80">
                      National Railway Reservation and Management System
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Ticket Number
                  </span>
                  <span className="text-sm font-mono font-bold text-white tracking-wide">
                    {ticket.ticket_number}
                  </span>
                </div>
              </div>
            </div>

            {/* Ticket Content Body */}
            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              
              {/* Left Column: PNR & Journey Info */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Big PNR Display */}
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Passenger Name Record (PNR)
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-wider">
                      {ticket.pnr}
                    </span>
                    <button
                      onClick={() => handleCopy(ticket.pnr)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Copy PNR"
                    >
                      {copiedPnr ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Train Information (G4 Integration Contract) */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
                    <Train className="w-4 h-4" />
                    <span>Train & Journey Service (G4 Contract)</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200">
                    {ticket.train_name || 'Superfast Express Express (G4 Scheduled)'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {ticket.from_station && ticket.to_station
                      ? `${ticket.from_station} → ${ticket.to_station}`
                      : 'Assigned coach and seat coordinates managed by Group 4 reservations.'}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Fare Paid
                    </span>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {formatCurrency(ticket.amount)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Issued At
                    </span>
                    <div className="text-xs font-semibold text-slate-200 mt-0.5">
                      {formatDateTime(ticket.issued_at)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Payment Mode
                    </span>
                    <div className="text-xs font-semibold text-blue-300 mt-0.5">
                      NRRMS Wallet
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Station Verification QR Code */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                <div className="bg-white p-3 rounded-2xl shadow-xl">
                  {qrImageUrl ? (
                    <img
                      src={qrImageUrl}
                      alt={`QR Code for PNR ${ticket.pnr}`}
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 flex items-center justify-center text-slate-900">
                      <QrCode className="w-28 h-28" />
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-3">
                  Station Verification QR
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Scan at automated railway turnstiles
                </span>
              </div>

            </div>

            {/* Boarding Notice Footer */}
            <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Carry a valid government photo ID. Valid only with matching PNR.</span>
              </div>
              <div className="font-mono text-slate-500 text-[10px]">
                Secured by G5 Ledger Service
              </div>
            </div>

          </div>
        </div>
      ) : null}

    </div>
  );
}

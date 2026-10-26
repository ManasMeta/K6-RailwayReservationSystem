import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  Filter,
  Search,
  Train,
  UserX,
  Users,
} from 'lucide-react';
import { useReservations } from '../hooks/useReservations';
import { Reservation, ReservationStatus } from '../types';
import { CancelModal } from './CancelModal';
import { HoldCountdownTimer } from './HoldCountdownTimer';

interface MyJourneysProps {
  onNewBookingClick?: () => void;
  /** Called when the passenger chooses to pay for a held reservation. */
  onPayClick?: (pnr: string) => void;
}

export const MyJourneys: React.FC<MyJourneysProps> = ({ onNewBookingClick, onPayClick }) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null);
  const [selectedForCancel, setSelectedForCancel] = useState<Reservation | null>(null);

  const { data, isLoading, error, refetch } = useReservations({ page: 1, page_size: 20 });

  const handleCopyPnr = (pnr: string) => {
    navigator.clipboard.writeText(pnr);
    setCopiedPnr(pnr);
    setTimeout(() => setCopiedPnr(null), 2000);
  };

  // Filter journeys by tab and search query
  const filteredItems = (data?.items || []).filter((item) => {
    // Tab filter
    if (activeTab === 'ACTIVE') {
      if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(item.status)) return false;
    } else if (activeTab === 'CANCELLED') {
      if (!['CANCELLED', 'PARTIALLY_CANCELLED'].includes(item.status)) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesPnr = item.pnr.toLowerCase().includes(q);
      const matchesTrain = item.train_no.toLowerCase().includes(q);
      const matchesStation =
        item.from_station_code.toLowerCase().includes(q) ||
        item.to_station_code.toLowerCase().includes(q);
      return matchesPnr || matchesTrain || matchesStation;
    }

    return true;
  });

  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            CONFIRMED
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
            HOLD (PENDING PAYMENT)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
            CANCELLED
          </span>
        );
      case 'PARTIALLY_CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">
            PARTIALLY CANCELLED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            EXPIRED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-slate-100 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Train className="w-6 h-6 text-indigo-400" />
            <span>My Journeys & Bookings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your booked railway reservations, monitor seat statuses, and process cancellations.
          </p>
        </div>

        {onNewBookingClick && (
          <button
            onClick={onNewBookingClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-500/20 flex items-center gap-2 self-start sm:self-auto"
          >
            <span>Book New Ticket</span>
          </button>
        )}
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Bookings
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active & Upcoming
          </button>
          <button
            onClick={() => setActiveTab('CANCELLED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'CANCELLED'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cancelled
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PNR or Train..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Fetching your journeys...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm">
          Failed to load journeys. Please ensure backend services are online.
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Reservations Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `No bookings matching "${searchQuery}". Try clearing search filters.`
              : 'You do not have any active journeys in this view.'}
          </p>
        </div>
      )}

      {/* Journey Cards List */}
      <div className="space-y-4">
        {filteredItems.map((res: Reservation) => {
          const hasActivePassengers = res.passengers.some(
            (p) => p.current_status !== 'CANCELLED'
          );

          return (
            <div
              key={res.reservation_id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all shadow-xl space-y-4 relative overflow-hidden"
            >
              {/* Card Header: PNR + Status + Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">PNR:</span>
                    <span className="font-mono font-bold text-sm text-indigo-400">{res.pnr}</span>
                    <button
                      onClick={() => handleCopyPnr(res.pnr)}
                      className="text-slate-500 hover:text-slate-300 transition"
                      title="Copy PNR"
                    >
                      {copiedPnr === res.pnr ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {getStatusBadge(res.status)}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Total Fare:</span>
                  <span className="font-mono font-bold text-base text-emerald-400">
                    ₹{Number(res.total_fare).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Hold Countdown if in PENDING_PAYMENT */}
              {res.status === 'PENDING_PAYMENT' && (
                <HoldCountdownTimer expiresAt={res.hold_expires_at} onExpire={refetch} />
              )}

              {/* Route & Train Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-1 text-xs">
                <div>
                  <span className="text-slate-400">Train Details:</span>
                  <p className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <Train className="w-4 h-4 text-indigo-400" />
                    <span>{res.train_no} · {res.train_name || 'Express'}</span>
                  </p>
                </div>

                <div>
                  <span className="text-slate-400">Journey Route:</span>
                  <p className="font-semibold text-sm text-slate-100 mt-0.5">
                    {res.from_station_code} → {res.to_station_code}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400">Journey Date & Class:</span>
                  <p className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{res.run_date}</span>
                    <span className="text-slate-500">•</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[11px] font-mono">
                      {res.class_code} ({res.quota_code})
                    </span>
                  </p>
                </div>
              </div>

              {/* Passenger Berth Details List */}
              <div className="pt-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Passengers ({res.passengers.length})
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {res.passengers.map((p, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        p.current_status === 'CANCELLED'
                          ? 'border-red-900/30 bg-red-950/10 opacity-60 text-slate-400'
                          : 'border-slate-800 bg-slate-950/40 text-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium truncate max-w-[140px]">{p.passenger_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {p.age}y · {p.gender}
                        </p>
                      </div>

                      <div className="text-right">
                        {p.current_status === 'CNF' ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold text-[11px]">
                            {p.coach_code}-{p.berth_number} ({p.berth_type})
                          </span>
                        ) : p.current_status === 'RAC' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold text-[11px]">
                            RAC #{p.rac_number}
                          </span>
                        ) : p.current_status === 'WL' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-semibold text-[11px]">
                            WL #{p.wl_number}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px]">
                            CANCELLED
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Cancel, Pay, Ticket */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/70">
                {res.status === 'PENDING_PAYMENT' && (
                  <button
                    onClick={() => onPayClick?.(res.pnr)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay Now</span>
                  </button>
                )}

                {hasActivePassengers && res.status !== 'CANCELLED' && res.status !== 'EXPIRED' && (
                  <button
                    onClick={() => setSelectedForCancel(res)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Cancel Passengers</span>
                  </button>
                )}

                {res.status === 'CONFIRMED' && (
                  <button
                    onClick={() => alert(`Downloading E-Ticket for PNR ${res.pnr}`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>E-Ticket</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancellation Modal Dialog */}
      {selectedForCancel && (
        <CancelModal
          reservation={selectedForCancel}
          isOpen={Boolean(selectedForCancel)}
          onClose={() => setSelectedForCancel(null)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};

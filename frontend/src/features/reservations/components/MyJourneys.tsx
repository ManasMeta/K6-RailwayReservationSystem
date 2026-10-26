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
import {
  dangerOutlineButton,
  iconButton,
  panel,
  pillCancelled,
  pillConfirmed,
  pillNeutral,
  pillPending,
  pillRac,
  pillWaitlist,
  primaryButton,
  softButton,
} from './ui';

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
        return <span className={pillConfirmed}>Confirmed</span>;
      case 'PENDING_PAYMENT':
        return <span className={pillPending}>Held · pending payment</span>;
      case 'CANCELLED':
        return <span className={pillCancelled}>Cancelled</span>;
      case 'PARTIALLY_CANCELLED':
        return <span className={pillRac}>Partially cancelled</span>;
      case 'EXPIRED':
        return <span className={pillWaitlist}>Expired</span>;
      default:
        return null;
    }
  };

  const tabs = [
    { key: 'ALL', label: 'All bookings' },
    { key: 'ACTIVE', label: 'Upcoming' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ] as const;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 text-ink animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <h1 className="text-[40px] sm:text-[56px] font-heading leading-none">My journeys.</h1>
          <p className="mt-3 text-xl font-light text-muted max-w-xl">
            Track seat status, pay for held berths, and cancel passengers when plans change.
          </p>
        </div>

        {onNewBookingClick && (
          <button onClick={onNewBookingClick} className={`${primaryButton} self-start sm:self-auto`}>
            Book a new ticket
          </button>
        )}
      </div>

      {/* Segmented tabs and search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex sm:inline-flex items-center gap-1 p-1 rounded-full bg-canvas-soft" role="group" aria-label="Filter bookings">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              aria-pressed={activeTab === t.key}
              className={`flex-1 sm:flex-none h-10 px-4 rounded-full text-sm font-strong transition-colors ${
                activeTab === t.key ? 'bg-canvas text-ink shadow-segment' : 'text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Search bookings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PNR, train or station"
            className="rounded-full pl-11"
          />
        </div>
      </div>

      {/* Loading & error states */}
      {isLoading && (
        <div className="py-16 text-center text-muted space-y-3" role="status">
          <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Fetching your journeys…</p>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 pl-5 rounded-tile bg-danger-soft text-danger text-sm font-strong">
          Failed to load journeys. Please ensure backend services are online.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredItems.length === 0 && (
        <div className="py-16 px-8 text-center rounded-card bg-canvas-soft space-y-3">
          <div className="w-14 h-14 rounded-squircle bg-canvas flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-heading">No reservations found.</h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            {searchQuery
              ? `No bookings match "${searchQuery}". Try clearing the search.`
              : 'You do not have any journeys in this view.'}
          </p>
        </div>
      )}

      {/* Journey cards */}
      <div className="space-y-3">
        {filteredItems.map((res: Reservation) => {
          const hasActivePassengers = res.passengers.some(
            (p) => p.current_status !== 'CANCELLED'
          );
          const canCancel = hasActivePassengers && res.status !== 'CANCELLED' && res.status !== 'EXPIRED';
          const hasActions = canCancel || res.status === 'PENDING_PAYMENT' || res.status === 'CONFIRMED';

          return (
            <article key={res.reservation_id} className={`${panel} space-y-6`}>
              {/* PNR, status and fare */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(res.status)}
                    <span className={pillNeutral}>
                      {res.class_code} · {res.quota_code}
                    </span>
                  </div>
                  <h2 className="flex items-center gap-2 text-2xl font-heading leading-tight">
                    <span>PNR <span className="tabular-nums">{res.pnr}</span></span>
                    <button
                      onClick={() => handleCopyPnr(res.pnr)}
                      className={iconButton}
                      title="Copy PNR"
                      aria-label={`Copy PNR ${res.pnr}`}
                    >
                      {copiedPnr === res.pnr ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-sm text-muted">Total fare</span>
                  <p className="text-[32px] font-heading leading-none tabular-nums">
                    ₹{Number(res.total_fare).toFixed(2)}
                  </p>
                </div>
              </div>

              {res.status === 'PENDING_PAYMENT' && (
                <HoldCountdownTimer expiresAt={res.hold_expires_at} onExpire={refetch} />
              )}

              {/* Route & train */}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-4 rounded-tile bg-canvas-soft">
                  <dt className="text-xs font-strong text-muted">Train</dt>
                  <dd className="mt-1 font-strong flex items-center gap-2">
                    <Train className="w-4 h-4 flex-none" />
                    <span className="truncate">{res.train_name ? `${res.train_no} · ${res.train_name}` : res.train_no}</span>
                  </dd>
                </div>
                <div className="p-4 rounded-tile bg-canvas-soft">
                  <dt className="text-xs font-strong text-muted">Route</dt>
                  <dd className="mt-1 font-strong">
                    {res.from_station_code} → {res.to_station_code}
                  </dd>
                </div>
                <div className="p-4 rounded-tile bg-canvas-soft">
                  <dt className="text-xs font-strong text-muted">Journey date</dt>
                  <dd className="mt-1 font-strong flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{res.run_date}</span>
                  </dd>
                </div>
              </dl>

              {/* Passengers */}
              <div>
                <h3 className="flex items-center gap-2 mb-3 text-sm font-strong">
                  <Users className="w-4 h-4" />
                  Passengers ({res.passengers.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {res.passengers.map((p, idx) => (
                    <div
                      key={idx}
                      className={`p-3 pl-4 rounded-tile border border-hairline flex items-center justify-between gap-3 ${
                        p.current_status === 'CANCELLED' ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-strong text-sm truncate">{p.passenger_name}</p>
                        <p className="text-xs text-muted">
                          {p.age}y · {p.gender}
                        </p>
                      </div>

                      {p.current_status === 'CNF' ? (
                        <span className={pillConfirmed}>
                          {p.coach_code}-{p.berth_number} ({p.berth_type})
                        </span>
                      ) : p.current_status === 'RAC' ? (
                        <span className={pillRac}>RAC #{p.rac_number}</span>
                      ) : p.current_status === 'WL' ? (
                        <span className={pillWaitlist}>WL #{p.wl_number}</span>
                      ) : (
                        <span className={pillCancelled}>Cancelled</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions: pay, cancel, ticket */}
              {hasActions && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-5 border-t border-hairline-soft">
                  {canCancel && (
                    <button onClick={() => setSelectedForCancel(res)} className={dangerOutlineButton}>
                      <UserX className="w-4 h-4" />
                      <span>Cancel passengers</span>
                    </button>
                  )}

                  {res.status === 'CONFIRMED' && (
                    <button
                      onClick={() => alert(`Downloading E-Ticket for PNR ${res.pnr}`)}
                      className={softButton}
                    >
                      <Download className="w-4 h-4" />
                      <span>E-ticket</span>
                    </button>
                  )}

                  {res.status === 'PENDING_PAYMENT' && (
                    <button
                      onClick={() => onPayClick?.(res.pnr)}
                      className={`${primaryButton} min-h-[40px] px-5 text-sm`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Pay now</span>
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Cancellation dialog */}
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

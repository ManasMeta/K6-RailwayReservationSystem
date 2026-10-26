import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  UserX,
  X,
} from 'lucide-react';
import { useCancelPassengers } from '../hooks/useReservations';
import { CancellationResponse, Passenger, Reservation } from '../types';
import { dangerButton, fieldLabel, iconButton, outlineButton, pillOnSoft, primaryButton } from './ui';

interface CancelModalProps {
  reservation: Reservation;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: CancellationResponse) => void;
}

export const CancelModal: React.FC<CancelModalProps> = ({
  reservation,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<number[]>([]);
  const [reason, setReason] = useState<string>('Change of travel plans');
  const [cancellationResult, setCancellationResult] = useState<CancellationResponse | null>(null);

  const cancelMutation = useCancelPassengers();

  if (!isOpen) return null;

  const activePassengers = reservation.passengers.filter(
    (p) => p.current_status !== 'CANCELLED' && p.passenger_id !== undefined
  );

  const togglePassenger = (id: number) => {
    setSelectedPassengerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPassengerIds.length === activePassengers.length) {
      setSelectedPassengerIds([]);
    } else {
      setSelectedPassengerIds(
        activePassengers.map((p) => p.passenger_id!).filter(Boolean)
      );
    }
  };

  // Rough estimation of refund for selected passengers
  const estimatedFare = selectedPassengerIds.reduce((sum, id) => {
    const p = reservation.passengers.find((item) => item.passenger_id === id);
    return sum + (p ? Number(p.fare || 0) : 0);
  }, 0);

  // Cancellation charge estimate (approx 200 per passenger for AC, 60 for non-AC)
  const isAcClass = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(reservation.class_code);
  const approxPerPassengerCharge = isAcClass ? 180 : 60;
  const estimatedCharge = selectedPassengerIds.length * approxPerPassengerCharge;
  const estimatedRefund = Math.max(0, estimatedFare - estimatedCharge);

  const handleConfirmCancel = async () => {
    if (selectedPassengerIds.length === 0) return;

    try {
      const res = await cancelMutation.mutateAsync({
        pnr: reservation.pnr,
        payload: {
          passenger_ids: selectedPassengerIds,
          reason,
        },
      });
      setCancellationResult(res);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      console.error('Cancellation failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--scrim)] backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-canvas rounded-card shadow-overlay p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-grid place-items-center w-11 h-11 rounded-squircle bg-danger-soft text-danger">
              <UserX className="w-5 h-5" />
            </span>
            <h3 id="cancel-title" className="mt-4 text-[32px] font-heading leading-[1.13]">Cancel passengers.</h3>
            <p className="mt-1 text-sm text-muted">
              PNR <span className="font-strong text-ink tabular-nums">{reservation.pnr}</span>
            </p>
          </div>
          <button onClick={onClose} className={iconButton} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {cancellationResult ? (
          /* Success */
          <div className="pt-6 space-y-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 flex-none" />
              <div>
                <h4 className="font-strong">Cancellation successful</h4>
                <p className="text-sm text-muted">
                  The berths were released and waiting passengers promoted. Your refund is on its way to your wallet.
                </p>
              </div>
            </div>

            <dl className="rounded-tile bg-canvas-soft px-5">
              <div className="flex justify-between py-3 text-sm border-b border-hairline">
                <dt className="text-muted">Cancelled passengers</dt>
                <dd className="font-strong">{cancellationResult.cancelled_passengers.length}</dd>
              </div>
              <div className="flex justify-between py-3 text-sm border-b border-hairline">
                <dt className="text-muted">Refund credited</dt>
                <dd className="font-heading tabular-nums">+₹{Number(cancellationResult.total_refund).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between py-3 text-sm">
                <dt className="text-muted">Booking status</dt>
                <dd className="font-strong">{cancellationResult.reservation_status}</dd>
              </div>
            </dl>

            <button onClick={onClose} className={`${primaryButton} w-full`}>
              Close
            </button>
          </div>
        ) : (
          /* Selection form */
          <div className="pt-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-strong">Choose passengers</span>
              <button type="button" onClick={toggleSelectAll} className="text-sm font-strong underline underline-offset-4">
                {selectedPassengerIds.length === activePassengers.length
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {activePassengers.map((p: Passenger) => {
                const isSelected = selectedPassengerIds.includes(p.passenger_id!);
                return (
                  <label
                    key={p.passenger_id}
                    className={`flex items-center justify-between gap-3 p-3 pl-4 rounded-tile cursor-pointer transition-colors ${
                      isSelected ? 'bg-canvas-soft shadow-[inset_0_0_0_2px_var(--ink)]' : 'bg-canvas-soft hover:bg-hairline'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePassenger(p.passenger_id!)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-strong truncate">{p.passenger_name}</span>
                        <span className="block text-xs text-muted">
                          {p.age} yrs · {p.gender} · {p.berth_type || p.berth_preference || 'No pref'}
                        </span>
                      </span>
                    </span>
                    <span className="text-right flex-none">
                      <span className={pillOnSoft}>
                        {p.current_status} {p.coach_code ? `${p.coach_code}-${p.berth_number}` : ''}
                      </span>
                      <span className="block text-xs text-muted mt-1 tabular-nums">₹{Number(p.fare || 0).toFixed(2)}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Refund estimate */}
            {selectedPassengerIds.length > 0 && (
              <dl className="rounded-tile border border-hairline px-5 text-sm">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-muted">Selected fare</dt>
                  <dd className="tabular-nums">₹{estimatedFare.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-hairline-soft">
                  <dt className="text-muted">Est. cancellation charge</dt>
                  <dd className="tabular-nums text-danger">−₹{estimatedCharge.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-hairline-soft">
                  <dt className="font-strong">Estimated refund</dt>
                  <dd className="font-heading text-base tabular-nums">₹{estimatedRefund.toFixed(2)}</dd>
                </div>
              </dl>
            )}

            <div>
              <label htmlFor="cancel-reason" className={fieldLabel}>
                Reason for cancellation
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Change in itinerary, urgent work"
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                Cancelling releases the allocated berths and promotes RAC and waitlisted passengers.
                The refund is credited to your wallet straight away.
              </span>
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={onClose} className={`${outlineButton} flex-1`}>
                Keep booking
              </button>
              <button
                type="button"
                disabled={selectedPassengerIds.length === 0 || cancelMutation.isPending}
                onClick={handleConfirmCancel}
                className={`${dangerButton} flex-1`}
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <span>Confirm cancellation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

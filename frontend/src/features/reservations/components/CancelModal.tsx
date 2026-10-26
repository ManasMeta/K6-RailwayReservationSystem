import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Info,
  Loader2,
  UserX,
  X,
} from 'lucide-react';
import { useCancelPassengers } from '../hooks/useReservations';
import { CancellationResponse, Passenger, Reservation } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">Cancel Reservation</h3>
              <p className="text-xs text-slate-400">PNR: <span className="font-mono font-medium text-slate-200">{reservation.pnr}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cancellationResult ? (
          /* Success Result State */
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-semibold text-slate-100">Cancellation Successful</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                The berth has been freed and promoted waiting passengers. Your refund has been initiated to your wallet.
              </p>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Cancelled Passengers:</span>
                <span className="text-slate-200 font-medium">
                  {cancellationResult.cancelled_passengers.length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Refund Credited:</span>
                <span className="text-emerald-400 font-semibold font-mono text-sm">
                  ₹{Number(cancellationResult.total_refund).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">New Booking Status:</span>
                <span className="text-amber-400 font-semibold uppercase">
                  {cancellationResult.reservation_status}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition"
            >
              Close Window
            </button>
          </div>
        ) : (
          /* Selection & Cancellation Form */
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Select Passengers to Cancel
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                {selectedPassengerIds.length === activePassengers.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            {/* Passenger List */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {activePassengers.map((p: Passenger) => {
                const isSelected = selectedPassengerIds.includes(p.passenger_id!);
                return (
                  <div
                    key={p.passenger_id}
                    onClick={() => togglePassenger(p.passenger_id!)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-red-500/50 bg-red-950/20 text-slate-100'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-red-600 bg-slate-800 border-slate-700 focus:ring-red-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{p.passenger_name}</p>
                        <p className="text-xs text-slate-400">
                          {p.age} yrs · {p.gender} · {p.berth_type || p.berth_preference || 'No pref'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {p.current_status} {p.coach_code ? `${p.coach_code}-${p.berth_number}` : ''}
                      </span>
                      <p className="text-xs font-mono text-slate-400 mt-1">₹{Number(p.fare || 0).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Refund Estimation Panel */}
            {selectedPassengerIds.length > 0 && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Selected Total Fare:</span>
                  <span className="font-mono text-slate-200">₹{estimatedFare.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Est. Cancellation Surcharge:</span>
                  <span className="font-mono text-red-400">-₹{estimatedCharge.toFixed(2)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-semibold text-slate-200">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <DollarSign className="w-3.5 h-3.5" /> Estimated Refund:
                  </span>
                  <span className="font-mono text-emerald-400 text-sm">₹{estimatedRefund.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Reason selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Reason for Cancellation
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Change in itinerary, urgent work"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Warning Note */}
            <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-[11px]">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Cancelling will permanently release allocated berths and promote RAC/WL passengers.
                Refund will be credited to your in-app wallet immediately.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={selectedPassengerIds.length === 0 || cancelMutation.isPending}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Cancellation</span>
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

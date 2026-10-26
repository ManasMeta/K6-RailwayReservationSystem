import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Plus,
  Sparkles,
  Train,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  useCreateReservation,
  useConfirmReservation,
  useSavedPassengers,
} from '../hooks/useReservations';
import { BerthPreference, QuotaCode, Reservation } from '../types';
import { HoldCountdownTimer } from './HoldCountdownTimer';
import { TatkalCountdown } from './TatkalCountdown';

interface BookingFlowProps {
  initialTrainNo?: string;
  initialTrainName?: string;
  initialFromStation?: string;
  initialToStation?: string;
  initialRunDate?: string;
  initialClassCode?: string;
  onBookingSuccess?: (pnr: string) => void;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({
  initialTrainNo = '12424',
  initialTrainName = 'Dibrugarh Rajdhani Express',
  initialFromStation = 'NDLS',
  initialToStation = 'DDU',
  initialRunDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  initialClassCode = '3A',
  onBookingSuccess,
}) => {
  // Train & Route State
  const [trainNo] = useState(initialTrainNo);
  const [trainName] = useState(initialTrainName);
  const [fromStation] = useState(initialFromStation);
  const [toStation] = useState(initialToStation);
  const [runDate, setRunDate] = useState(initialRunDate);
  const [classCode, setClassCode] = useState(initialClassCode);
  const [quotaCode, setQuotaCode] = useState<QuotaCode>('GN');

  // Passenger list state
  const [passengers, setPassengers] = useState<
    Array<{
      passenger_name: string;
      age: number | '';
      gender: string;
      berth_preference: BerthPreference | '';
      senior_citizen: boolean;
    }>
  >([
    {
      passenger_name: '',
      age: '',
      gender: 'Male',
      berth_preference: 'LB',
      senior_citizen: false,
    },
  ]);

  // Active Hold Result state
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries and Mutations
  const { data: savedPassengers } = useSavedPassengers();
  const createReservationMutation = useCreateReservation();
  const confirmReservationMutation = useConfirmReservation();

  const isAcClass = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(classCode);

  // Handle passenger fields
  const handlePassengerChange = (index: number, field: string, value: any) => {
    setPassengers((prev) => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };
      if (field === 'age') {
        const numAge = Number(value);
        p.senior_citizen = numAge >= 60;
      }
      updated[index] = p;
      return updated;
    });
  };

  const addPassenger = () => {
    if (passengers.length >= 6) return;
    setPassengers((prev) => [
      ...prev,
      {
        passenger_name: '',
        age: '',
        gender: 'Male',
        berth_preference: 'LB',
        senior_citizen: false,
      },
    ]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers((prev) => prev.filter((_, i) => i !== index));
  };

  const addSavedPassenger = (saved: any) => {
    if (passengers.length >= 6) return;
    // Replace first if empty, else append
    if (passengers.length === 1 && !passengers[0].passenger_name) {
      setPassengers([
        {
          passenger_name: saved.full_name,
          age: saved.age,
          gender: saved.gender,
          berth_preference: saved.berth_preference || 'LB',
          senior_citizen: saved.senior_citizen || saved.age >= 60,
        },
      ]);
    } else {
      setPassengers((prev) => [
        ...prev,
        {
          passenger_name: saved.full_name,
          age: saved.age,
          gender: saved.gender,
          berth_preference: saved.berth_preference || 'LB',
          senior_citizen: saved.senior_citizen || saved.age >= 60,
        },
      ]);
    }
  };

  const handleCopyPnr = (pnr: string) => {
    navigator.clipboard.writeText(pnr);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCreateHold = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate passengers
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].passenger_name.trim()) {
        setErrorMsg(`Please enter a valid name for Passenger ${i + 1}`);
        return;
      }
      if (!passengers[i].age || Number(passengers[i].age) < 1) {
        setErrorMsg(`Please enter a valid age for Passenger ${i + 1}`);
        return;
      }
    }

    try {
      const payload = {
        train_no: trainNo,
        run_date: runDate,
        from_station_code: fromStation,
        to_station_code: toStation,
        class_code: classCode,
        quota_code: quotaCode,
        passengers: passengers.map((p) => ({
          passenger_name: p.passenger_name.trim(),
          age: Number(p.age),
          gender: p.gender,
          berth_preference: p.berth_preference || null,
          senior_citizen: p.senior_citizen,
        })),
      };

      const res = await createReservationMutation.mutateAsync(payload);
      setActiveReservation(res);
    } catch (err: any) {
      setErrorMsg(err.detail || 'Booking request failed. Please check date or quota availability.');
    }
  };

  const handleConfirmPayment = async () => {
    if (!activeReservation) return;
    try {
      await confirmReservationMutation.mutateAsync(activeReservation.pnr);
      setActiveReservation((prev) => (prev ? { ...prev, status: 'CONFIRMED' } : null));
      if (onBookingSuccess) {
        onBookingSuccess(activeReservation.pnr);
      }
    } catch (err: any) {
      setErrorMsg(err.detail || 'Payment confirmation failed');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in text-slate-100">
      {/* Train & Journey Card Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Train className="w-48 h-48" />
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Superfast Express
              </span>
              <span className="text-xs text-slate-400">Class: <strong className="text-slate-200">{classCode}</strong></span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{trainNo}</span>
              <span className="text-indigo-300">·</span>
              <span>{trainName}</span>
            </h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-300">
              <span className="font-semibold text-white">{fromStation}</span>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-white">{toStation}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">Date: {runDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Class:</label>
              <select
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                disabled={Boolean(activeReservation)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="1A">1A (First AC)</option>
                <option value="2A">2A (AC 2-Tier)</option>
                <option value="3A">3A (AC 3-Tier)</option>
                <option value="3E">3E (AC 3 Economy)</option>
                <option value="CC">CC (AC Chair Car)</option>
                <option value="SL">SL (Sleeper)</option>
                <option value="2S">2S (Second Sitting)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Travel Date:</label>
              <input
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                disabled={Boolean(activeReservation)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quota Selection Tabs */}
      {!activeReservation && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Select Reservation Quota
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { code: 'GN', label: 'General', desc: 'Standard 60-day reservation window' },
              { code: 'TQ', label: 'Tatkal', desc: 'Opens 1 day before departure' },
              { code: 'LD', label: 'Ladies', desc: 'Reserved for solo female travellers' },
              { code: 'SS', label: 'Senior Citizen', desc: 'Lower berth quota for 60+ yrs' },
            ].map((q) => (
              <button
                key={q.code}
                type="button"
                onClick={() => setQuotaCode(q.code as QuotaCode)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  quotaCode === q.code
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-100">{q.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {q.code}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{q.desc}</p>
              </button>
            ))}
          </div>

          {/* Tatkal Countdown Banner if Tatkal Quota selected */}
          {quotaCode === 'TQ' && (
            <TatkalCountdown runDate={runDate} classCode={classCode} isAc={isAcClass} />
          )}
        </div>
      )}

      {/* ACTIVE HOLD SCREEN (When Reservation is Created) */}
      {activeReservation ? (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-indigo-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeReservation.status}
                </span>
                <span className="text-xs text-slate-400">Quota: {activeReservation.quota_code}</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                <span>PNR:</span>
                <span className="font-mono text-indigo-400">{activeReservation.pnr}</span>
                <button
                  onClick={() => handleCopyPnr(activeReservation.pnr)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                  title="Copy PNR"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </h3>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400">Total Payable Fare</span>
              <p className="text-2xl font-mono font-bold text-emerald-400">
                ₹{Number(activeReservation.total_fare).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 10-Minute Hold Countdown */}
          {activeReservation.status === 'PENDING_PAYMENT' && (
            <HoldCountdownTimer expiresAt={activeReservation.hold_expires_at} />
          )}

          {/* Confirmed / Allocated Passengers Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Allocated Passengers & Berths
            </h4>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              {activeReservation.passengers.map((p, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-slate-100">{p.passenger_name}</p>
                    <p className="text-xs text-slate-400">
                      {p.age} yrs · {p.gender} {p.senior_citizen && '· Senior Citizen'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {p.current_status === 'CNF' ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        CNF: Coach {p.coach_code || 'B1'}, Berth {p.berth_number} ({p.berth_type})
                      </span>
                    ) : p.current_status === 'RAC' ? (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        RAC #{p.rac_number} (Reserved Against Cancellation)
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                        WL #{p.wl_number} (Waitlist)
                      </span>
                    )}

                    <span className="font-mono text-sm text-slate-300">₹{Number(p.fare).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Actions */}
          {activeReservation.status === 'PENDING_PAYMENT' ? (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveReservation(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                Book Another Ticket
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={confirmReservationMutation.isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay from Yatrio Wallet (₹{Number(activeReservation.total_fare).toFixed(2)})</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-emerald-200">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Payment Confirmed. E-Ticket has been generated and emailed.</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveReservation(null)}
                className="text-xs px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg font-medium text-emerald-300 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      ) : (
        /* PASSENGER DETAILS FORM & SAVED PASSENGERS */
        <form onSubmit={handleCreateHold} className="space-y-6">
          {/* Quick-Pick Saved Passengers (G1 Contract) */}
          {savedPassengers && savedPassengers.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  Quick-Add Saved Passengers
                </span>
                <span className="text-xs text-slate-500">{savedPassengers.length} saved</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {savedPassengers.map((sp) => (
                  <button
                    key={sp.passenger_id}
                    type="button"
                    onClick={() => addSavedPassenger(sp)}
                    disabled={passengers.some((p) => p.passenger_name === sp.full_name)}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-slate-900 text-left transition disabled:opacity-40 disabled:hover:border-slate-800 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-slate-200 truncate group-hover:text-indigo-300">
                        {sp.full_name}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {sp.age} yrs · {sp.gender} {sp.berth_preference && `· ${sp.berth_preference}`}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Passenger Input List */}
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Passenger Details (Max 6)
              </h3>
              <button
                type="button"
                onClick={addPassenger}
                disabled={passengers.length >= 6}
                className="px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Add Passenger
              </button>
            </div>

            <div className="space-y-3">
              {passengers.map((p, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-3 transition hover:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400">
                      Passenger #{index + 1}
                    </span>
                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className="text-slate-400 hover:text-red-400 transition"
                        title="Remove passenger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Full Name (as per Govt ID)
                      </label>
                      <input
                        type="text"
                        required
                        value={p.passenger_name}
                        onChange={(e) =>
                          handlePassengerChange(index, 'passenger_name', e.target.value)
                        }
                        placeholder="e.g. Aarav Sharma"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Age
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="125"
                        required
                        value={p.age}
                        onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                        placeholder="e.g. 29"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Gender
                      </label>
                      <select
                        value={p.gender}
                        onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Transgender">Transgender</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Berth Preference
                      </label>
                      <select
                        value={p.berth_preference}
                        onChange={(e) =>
                          handlePassengerChange(index, 'berth_preference', e.target.value)
                        }
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="LB">Lower Berth (LB)</option>
                        <option value="MB">Middle Berth (MB)</option>
                        <option value="UB">Upper Berth (UB)</option>
                        <option value="SL">Side Lower (SL)</option>
                        <option value="SU">Side Upper (SU)</option>
                        <option value="WS">Window Side (WS)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id={`senior-${index}`}
                        checked={p.senior_citizen}
                        onChange={(e) =>
                          handlePassengerChange(index, 'senior_citizen', e.target.checked)
                        }
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                      />
                      <label htmlFor={`senior-${index}`} className="text-xs text-slate-300">
                        Senior Citizen concession (60+ yrs)
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center gap-3 text-red-200">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm">{errorMsg}</span>
            </div>
          )}

          {/* Submit Hold Action */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div>
              <span className="text-xs text-slate-400">Total Passengers: {passengers.length}</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Seats will be held for 10 minutes upon proceeding.
              </p>
            </div>

            <button
              type="submit"
              disabled={createReservationMutation.isPending}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {createReservationMutation.isPending
                  ? 'Allocating Berths...'
                  : 'Proceed to Berth Hold'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

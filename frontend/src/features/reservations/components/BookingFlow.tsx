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
  Trash2,
  Users,
} from 'lucide-react';
import { errorMessage } from '../../../api/client';
import { useCreateReservation, useSavedPassengers } from '../hooks/useReservations';
import { BerthPreference, QuotaCode, Reservation, SavedPassenger } from '../types';
import { HoldCountdownTimer } from './HoldCountdownTimer';
import { TatkalCountdown } from './TatkalCountdown';
import {
  fieldLabel,
  iconButton,
  outlineButton,
  panel,
  pillConfirmed,
  pillOnSoft,
  pillPending,
  pillRac,
  pillWaitlist,
  primaryButton,
  sectionTitle,
  softButton,
  softPanel,
} from './ui';

interface PassengerRow {
  passenger_name: string;
  age: number | '';
  gender: string;
  berth_preference: BerthPreference | '';
  senior_citizen: boolean;
}

interface BookingFlowProps {
  initialTrainNo?: string;
  initialTrainName?: string;
  initialFromStation?: string;
  initialToStation?: string;
  initialRunDate?: string;
  initialClassCode?: string;
  /** Called when the passenger chooses to pay for the held reservation. */
  onPayClick?: (pnr: string) => void;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({
  initialTrainNo = '12424',
  initialTrainName = 'Dibrugarh Rajdhani Express',
  initialFromStation = 'NDLS',
  initialToStation = 'DDU',
  initialRunDate = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  initialClassCode = '3A',
  onPayClick,
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
  const [passengers, setPassengers] = useState<PassengerRow[]>([
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

  const isAcClass = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(classCode);

  // Handle passenger fields
  const handlePassengerChange = (
    index: number,
    field: keyof PassengerRow,
    value: string | number | boolean,
  ) => {
    setPassengers((prev) => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value } as PassengerRow;
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

  const addSavedPassenger = (saved: SavedPassenger) => {
    if (passengers.length >= 6) return;
    // Replace first if empty, else append
    if (passengers.length === 1 && !passengers[0].passenger_name) {
      setPassengers([
        {
          passenger_name: saved.full_name,
          age: saved.age,
          gender: saved.gender,
          berth_preference: (saved.berth_preference || 'LB') as BerthPreference,
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
          berth_preference: (saved.berth_preference || 'LB') as BerthPreference,
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
    } catch (err) {
      setErrorMsg(errorMessage(err));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 animate-fade-in text-ink">
      {/* Train & journey header */}
      <div className={softPanel}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={pillOnSoft}>Superfast express</span>
              <span className={pillOnSoft}>Class {classCode}</span>
            </div>
            <h1 className="text-[32px] sm:text-[44px] font-heading leading-[1.05] text-ink">
              <span className="text-muted">{trainNo}</span> <span>{trainName}</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xl font-light text-muted">
              <span className="font-heading text-ink">{fromStation}</span>
              <ArrowRight className="w-5 h-5" aria-label="to" />
              <span className="font-heading text-ink">{toStation}</span>
              <span aria-hidden="true">·</span>
              <span>{runDate}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="booking-class" className={fieldLabel}>Class</label>
              <select
                id="booking-class"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                disabled={Boolean(activeReservation)}
                className="min-w-[12rem] bg-canvas"
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

            <div>
              <label htmlFor="booking-date" className={fieldLabel}>Travel date</label>
              <input
                id="booking-date"
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                disabled={Boolean(activeReservation)}
                className="bg-canvas"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quota selection */}
      {!activeReservation && (
        <div className={`${panel} space-y-5`}>
          <div>
            <h2 className={sectionTitle}>Choose a quota.</h2>
            <p className="mt-1 text-sm text-muted">Each quota has its own booking window and berths.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { code: 'GN', label: 'General', desc: 'Standard 60-day reservation window' },
              { code: 'TQ', label: 'Tatkal', desc: 'Opens 1 day before departure' },
              { code: 'LD', label: 'Ladies', desc: 'Reserved for solo female travellers' },
              { code: 'SS', label: 'Senior citizen', desc: 'Lower berth quota for 60+ yrs' },
            ].map((q) => {
              const selected = quotaCode === q.code;
              return (
                <button
                  key={q.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setQuotaCode(q.code as QuotaCode)}
                  className={`p-4 rounded-tile text-left transition-colors ${
                    selected ? 'bg-primary text-on-primary' : 'bg-canvas-soft text-ink hover:bg-hairline'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-strong">{q.label}</span>
                    <span className="px-2 h-5 inline-grid place-items-center rounded-full bg-canvas text-ink text-[11px] font-strong">
                      {q.code}
                    </span>
                  </div>
                  <p className={`text-xs mt-2 leading-snug ${selected ? 'opacity-70' : 'text-muted'}`}>{q.desc}</p>
                </button>
              );
            })}
          </div>

          {quotaCode === 'TQ' && (
            <TatkalCountdown runDate={runDate} classCode={classCode} isAc={isAcClass} />
          )}
        </div>
      )}

      {/* Active hold, once the reservation is created */}
      {activeReservation ? (
        <div className={`${panel} space-y-6`}>
          <div className="flex items-end justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className={activeReservation.status === 'PENDING_PAYMENT' ? pillPending : pillConfirmed}>
                  {activeReservation.status === 'PENDING_PAYMENT' ? 'Held · awaiting payment' : activeReservation.status}
                </span>
                <span className="text-sm text-muted">Quota {activeReservation.quota_code}</span>
              </div>
              <h2 className="mt-4 flex items-center gap-3 text-[32px] font-heading leading-[1.13]">
                <span>PNR <span className="tabular-nums">{activeReservation.pnr}</span></span>
                <button
                  type="button"
                  onClick={() => handleCopyPnr(activeReservation.pnr)}
                  className={iconButton}
                  title="Copy PNR"
                  aria-label="Copy PNR"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </h2>
            </div>

            <div className="text-right">
              <span className="text-sm text-muted">Total payable</span>
              <p className="text-[44px] font-heading leading-none tabular-nums text-accent">
                ₹{Number(activeReservation.total_fare).toFixed(2)}
              </p>
            </div>
          </div>

          {activeReservation.status === 'PENDING_PAYMENT' && (
            <HoldCountdownTimer expiresAt={activeReservation.hold_expires_at} />
          )}

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-strong">
              <Users className="w-4 h-4" /> Passengers and berths
            </h3>
            <div className="space-y-2">
              {activeReservation.passengers.map((p, idx) => (
                <div key={idx} className="p-4 pl-5 rounded-tile bg-canvas-soft flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-strong">{p.passenger_name}</p>
                    <p className="text-sm text-muted">
                      {p.age} yrs · {p.gender} {p.senior_citizen && '· Senior citizen'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    {p.current_status === 'CNF' ? (
                      <span className={pillConfirmed}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        CNF · {p.coach_code || 'B1'}-{p.berth_number} ({p.berth_type})
                      </span>
                    ) : p.current_status === 'RAC' ? (
                      <span className={pillRac}>
                        <Clock className="w-3.5 h-3.5" />
                        RAC #{p.rac_number}
                      </span>
                    ) : (
                      <span className={pillWaitlist}>WL #{p.wl_number}</span>
                    )}

                    <span className="text-sm font-strong tabular-nums">₹{Number(p.fare).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeReservation.status === 'PENDING_PAYMENT' ? (
            <div className="flex items-center justify-end flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => setActiveReservation(null)} className={outlineButton}>
                Book another ticket
              </button>
              <button type="button" onClick={() => onPayClick?.(activeReservation.pnr)} className={primaryButton}>
                <CreditCard className="w-4 h-4" />
                <span>Pay ₹{Number(activeReservation.total_fare).toFixed(2)} from wallet</span>
              </button>
            </div>
          ) : (
            <div className="p-3 pl-5 rounded-full bg-canvas-soft flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-strong">
                <CheckCircle className="w-5 h-5" />
                <span>Payment confirmed. Your e-ticket is ready.</span>
              </div>
              <button type="button" onClick={() => setActiveReservation(null)} className={`${softButton} bg-canvas`}>
                Done
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Passenger details form and saved passengers */
        <form onSubmit={handleCreateHold} className="space-y-3">
          {savedPassengers && savedPassengers.length > 0 && (
            <div className={`${panel} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-strong">Saved passengers</h2>
                <span className="text-sm text-muted">{savedPassengers.length} saved</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {savedPassengers.map((sp) => (
                  <button
                    key={sp.passenger_id}
                    type="button"
                    onClick={() => addSavedPassenger(sp)}
                    disabled={passengers.some((p) => p.passenger_name === sp.full_name)}
                    className="p-3 pl-4 rounded-tile bg-canvas-soft hover:bg-hairline text-left transition-colors disabled:opacity-40 disabled:hover:bg-canvas-soft flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-strong text-sm truncate">{sp.full_name}</span>
                      <span className="block text-xs text-muted mt-0.5">
                        {sp.age} yrs · {sp.gender} {sp.berth_preference && `· ${sp.berth_preference}`}
                      </span>
                    </span>
                    <span className="inline-grid place-items-center w-7 h-7 flex-none rounded-full bg-canvas">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`${panel} space-y-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={sectionTitle}>Who’s travelling.</h2>
                <p className="mt-1 text-sm text-muted">Up to 6 passengers per booking.</p>
              </div>
              <button type="button" onClick={addPassenger} disabled={passengers.length >= 6} className={softButton}>
                <Plus className="w-4 h-4" /> Add passenger
              </button>
            </div>

            <div className="space-y-2">
              {passengers.map((p, index) => (
                <div key={index} className="p-5 rounded-tile bg-canvas-soft space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-strong">Passenger {index + 1}</span>
                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className={`${iconButton} bg-canvas hover:text-danger`}
                        title="Remove passenger"
                        aria-label={`Remove passenger ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label htmlFor={`passenger-name-${index}`} className={fieldLabel}>
                        Full name (as on government ID)
                      </label>
                      <input
                        id={`passenger-name-${index}`}
                        type="text"
                        required
                        value={p.passenger_name}
                        onChange={(e) =>
                          handlePassengerChange(index, 'passenger_name', e.target.value)
                        }
                        placeholder="e.g. Aarav Sharma"
                        className="bg-canvas"
                      />
                    </div>

                    <div>
                      <label htmlFor={`passenger-age-${index}`} className={fieldLabel}>Age</label>
                      <input
                        id={`passenger-age-${index}`}
                        type="number"
                        min="1"
                        max="125"
                        required
                        value={p.age}
                        onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                        placeholder="e.g. 29"
                        className="bg-canvas"
                      />
                    </div>

                    <div>
                      <label htmlFor={`passenger-gender-${index}`} className={fieldLabel}>Gender</label>
                      <select
                        id={`passenger-gender-${index}`}
                        value={p.gender}
                        onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                        className="bg-canvas"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Transgender">Transgender</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`passenger-berth-${index}`} className={fieldLabel}>Berth preference</label>
                      <select
                        id={`passenger-berth-${index}`}
                        value={p.berth_preference}
                        onChange={(e) =>
                          handlePassengerChange(index, 'berth_preference', e.target.value)
                        }
                        className="bg-canvas"
                      >
                        <option value="LB">Lower Berth (LB)</option>
                        <option value="MB">Middle Berth (MB)</option>
                        <option value="UB">Upper Berth (UB)</option>
                        <option value="SL">Side Lower (SL)</option>
                        <option value="SU">Side Upper (SU)</option>
                        <option value="WS">Window Side (WS)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3 sm:pt-7">
                      <input
                        type="checkbox"
                        id={`senior-${index}`}
                        checked={p.senior_citizen}
                        onChange={(e) =>
                          handlePassengerChange(index, 'senior_citizen', e.target.checked)
                        }
                      />
                      <label htmlFor={`senior-${index}`} className="text-sm">
                        Senior citizen concession (60+ yrs)
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="p-4 pl-5 rounded-tile bg-danger-soft text-danger flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-strong">{errorMsg}</span>
            </div>
          )}

          <div className={`${softPanel} flex items-center justify-between flex-wrap gap-4`}>
            <div>
              <span className="font-strong">
                {passengers.length} {passengers.length === 1 ? 'passenger' : 'passengers'}
              </span>
              <p className="text-sm text-muted mt-0.5">
                Seats are held for 10 minutes once you continue.
              </p>
            </div>

            <button type="submit" disabled={createReservationMutation.isPending} className={primaryButton}>
              <span>
                {createReservationMutation.isPending ? 'Allocating berths…' : 'Hold berths'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

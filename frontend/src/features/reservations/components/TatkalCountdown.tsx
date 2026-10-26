import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Flame, Timer } from 'lucide-react';

interface TatkalCountdownProps {
  runDate: string; // YYYY-MM-DD
  classCode: string;
  isAc?: boolean;
  /** Opening time in IST, "HH:MM" or "HH:MM:SS", from GET /reservations/booking-rules. */
  opensAt?: string;
  className?: string;
}

/** Hours and minutes of an "HH:MM[:SS]" time; the plan's defaults when it is missing or malformed. */
export function parseOpeningTime(opensAt: string | undefined, isAc: boolean): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})/.exec(opensAt ?? '');
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour <= 24 && minute < 60) return { hour, minute };
  }
  return { hour: isAc ? 10 : 11, minute: 0 };
}

export const TatkalCountdown: React.FC<TatkalCountdownProps> = ({
  runDate,
  classCode,
  isAc = false,
  opensAt,
  className = '',
}) => {
  // Tatkal opens 1 day prior to travel, at the time booking_rules sets for AC or non-AC classes
  const { hour: targetHour, minute: targetMinute } = parseOpeningTime(opensAt, isAc);
  const openingLabel = `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`;

  const [timeDiff, setTimeDiff] = useState<{
    isOpen: boolean;
    hours: number;
    minutes: number;
    seconds: number;
    openDateStr: string;
  }>(() => calculateTimeDiff(runDate, targetHour, targetMinute));

  useEffect(() => {
    setTimeDiff(calculateTimeDiff(runDate, targetHour, targetMinute));
    const timer = setInterval(() => {
      setTimeDiff(calculateTimeDiff(runDate, targetHour, targetMinute));
    }, 1000);
    return () => clearInterval(timer);
  }, [runDate, targetHour, targetMinute]);

  function calculateTimeDiff(dateStr: string, hour: number, minute: number) {
    if (!dateStr) {
      return { isOpen: true, hours: 0, minutes: 0, seconds: 0, openDateStr: '' };
    }

    const travelDate = new Date(dateStr + 'T00:00:00');
    // Day before travel
    const openDate = new Date(travelDate);
    openDate.setDate(openDate.getDate() - 1);
    openDate.setHours(hour, minute, 0, 0);

    const now = new Date();
    const diffMs = openDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return {
        isOpen: true,
        hours: 0,
        minutes: 0,
        seconds: 0,
        openDateStr: openDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
      };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      isOpen: false,
      hours,
      minutes,
      seconds,
      openDateStr: openDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }),
    };
  }

  const { isOpen, hours, minutes, seconds, openDateStr } = timeDiff;

  const unit = (value: number, label: string) => (
    <div className="flex flex-col items-center min-w-[3.25rem] py-1.5 rounded-tile bg-canvas">
      <span className="text-xl font-heading leading-tight tabular-nums">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] font-strong text-muted">{label}</span>
    </div>
  );

  return (
    <div className={`p-4 pl-5 rounded-tile bg-canvas-soft ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-squircle bg-canvas flex items-center justify-center flex-none">
            {isOpen ? <Flame className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-strong text-sm">Tatkal quota ({classCode})</span>
              {/* Accent marks the one decision on this screen: Tatkal is open, book now. */}
              <span
                className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-strong ${
                  isOpen ? 'bg-accent text-white' : 'bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--hairline)]'
                }`}
              >
                {isOpen ? 'Booking open' : 'Opens 1 day before'}
              </span>
            </div>
            <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Opens {openDateStr} at {openingLabel} IST ({isAc ? 'AC class' : 'non-AC class'})
              </span>
            </p>
          </div>
        </div>

        {isOpen ? (
          <div className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-canvas text-sm font-strong">
            <CheckCircle2 className="w-4 h-4" />
            <span>Tatkal booking is active</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5" aria-label={`Opens in ${hours} hours ${minutes} minutes`}>
            {unit(hours, 'Hours')}
            <span className="font-heading text-muted">:</span>
            {unit(minutes, 'Mins')}
            <span className="font-heading text-muted">:</span>
            {unit(seconds, 'Secs')}
          </div>
        )}
      </div>
    </div>
  );
};

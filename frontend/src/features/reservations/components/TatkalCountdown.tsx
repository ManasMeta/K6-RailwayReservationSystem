import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Flame, Timer } from 'lucide-react';

interface TatkalCountdownProps {
  runDate: string; // YYYY-MM-DD
  classCode: string;
  isAc?: boolean;
  className?: string;
}

export const TatkalCountdown: React.FC<TatkalCountdownProps> = ({
  runDate,
  classCode,
  isAc = false,
  className = '',
}) => {
  // Tatkal opens 1 day prior to travel
  // 10:00 AM for AC classes, 11:00 AM for non-AC classes
  const targetHour = isAc ? 10 : 11;

  const [timeDiff, setTimeDiff] = useState<{
    isOpen: boolean;
    hours: number;
    minutes: number;
    seconds: number;
    openDateStr: string;
  }>(() => calculateTimeDiff(runDate, targetHour));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeDiff(calculateTimeDiff(runDate, targetHour));
    }, 1000);
    return () => clearInterval(timer);
  }, [runDate, targetHour]);

  function calculateTimeDiff(dateStr: string, hour: number) {
    if (!dateStr) {
      return { isOpen: true, hours: 0, minutes: 0, seconds: 0, openDateStr: '' };
    }

    const travelDate = new Date(dateStr + 'T00:00:00');
    // Day before travel
    const openDate = new Date(travelDate);
    openDate.setDate(openDate.getDate() - 1);
    openDate.setHours(hour, 0, 0, 0);

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

  return (
    <div
      className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
        isOpen
          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-100'
          : 'border-orange-500/40 bg-orange-950/20 text-orange-100'
      } ${className}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
            }`}
          >
            {isOpen ? <Flame className="w-5 h-5 animate-pulse" /> : <Timer className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide">
                Tatkal Quota ({classCode})
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  isOpen
                    ? 'bg-emerald-500/30 text-emerald-300'
                    : 'bg-orange-500/30 text-orange-300'
                }`}
              >
                {isOpen ? 'BOOKING OPEN' : 'OPENS 1 DAY BEFORE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Opens {openDateStr} at {targetHour}:00 AM ({isAc ? 'AC Class' : 'Non-AC Class'})
              </span>
            </p>
          </div>
        </div>

        <div>
          {isOpen ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
              <span>Tatkal Booking is Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col items-center bg-slate-900/80 px-2.5 py-1 rounded border border-orange-500/30">
                <span className="text-base font-mono font-bold text-orange-400">
                  {String(hours).padStart(2, '0')}
                </span>
                <span className="text-[9px] text-slate-400 uppercase">Hours</span>
              </div>
              <span className="text-orange-400 font-bold">:</span>
              <div className="flex flex-col items-center bg-slate-900/80 px-2.5 py-1 rounded border border-orange-500/30">
                <span className="text-base font-mono font-bold text-orange-400">
                  {String(minutes).padStart(2, '0')}
                </span>
                <span className="text-[9px] text-slate-400 uppercase">Mins</span>
              </div>
              <span className="text-orange-400 font-bold">:</span>
              <div className="flex flex-col items-center bg-slate-900/80 px-2.5 py-1 rounded border border-orange-500/30">
                <span className="text-base font-mono font-bold text-orange-400">
                  {String(seconds).padStart(2, '0')}
                </span>
                <span className="text-[9px] text-slate-400 uppercase">Secs</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

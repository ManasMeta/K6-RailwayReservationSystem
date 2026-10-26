import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, ShieldAlert } from 'lucide-react';

interface HoldCountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export const HoldCountdownTimer: React.FC<HoldCountdownTimerProps> = ({
  expiresAt,
  onExpire,
  className = '',
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    const calculateRemaining = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      const remaining = Math.max(0, diff);
      setSecondsRemaining(remaining);
      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress relative to 10 minutes (600 seconds)
  const totalSeconds = 600;
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / totalSeconds) * 100));

  // Determine urgency theme
  const isUrgent = secondsRemaining < 120; // under 2 mins
  const isWarning = secondsRemaining < 300 && !isUrgent; // under 5 mins

  // Ink while there is time; danger only for the last two minutes (Design.md).
  const strokeColor = isUrgent ? 'var(--danger)' : 'var(--ink)';
  const textColor = isUrgent ? 'text-danger' : 'text-ink';

  if (secondsRemaining <= 0) {
    return (
      <div role="status" className={`p-4 pl-5 rounded-tile bg-danger-soft text-danger flex items-center gap-3 ${className}`}>
        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-strong text-sm">Hold expired</p>
          <p className="text-xs">The 10-minute berth hold has expired and the seats went back to inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 pl-5 rounded-tile bg-canvas-soft ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center flex-none">
            {/* Circular progress ring */}
            <svg className="w-12 h-12 -rotate-90" aria-hidden="true">
              <circle cx="24" cy="24" r="18" stroke="var(--hairline)" strokeWidth="3" fill="none" />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke={strokeColor}
                strokeWidth="3"
                strokeDasharray="113.09"
                strokeDashoffset={113.09 - (113.09 * progressPercent) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500 ease-linear"
              />
            </svg>
            <Clock className={`w-4 h-4 absolute ${textColor}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-strong">Berths on hold</span>
              {(isUrgent || isWarning) && (
                <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-strong ${
                  isUrgent ? 'bg-danger text-white' : 'bg-canvas text-ink shadow-[inset_0_0_0_1px_var(--ink)]'
                }`}>
                  {isUrgent ? 'Expiring soon' : 'Under 5 min'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">Pay before the timer runs out to confirm these seats.</p>
          </div>
        </div>

        <div className="text-right flex-none">
          <span className={`text-[32px] font-heading leading-none tabular-nums ${textColor}`} aria-live="off">
            {formattedTime}
          </span>
          <p className="text-[11px] text-muted mt-1">minutes left</p>
        </div>
      </div>

      {isUrgent && (
        <div className="mt-3 pt-3 border-t border-hairline flex items-center gap-2 text-xs font-strong text-danger">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Less than 2 minutes left. Pay now to keep your berths.</span>
        </div>
      )}
    </div>
  );
};

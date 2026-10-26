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

  const strokeColor = isUrgent ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';
  const bgColor = isUrgent
    ? 'rgba(239, 68, 68, 0.12)'
    : isWarning
    ? 'rgba(245, 158, 11, 0.12)'
    : 'rgba(16, 185, 129, 0.12)';
  const textColor = isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400';
  const borderColor = isUrgent ? 'border-red-500/40' : isWarning ? 'border-amber-500/40' : 'border-emerald-500/40';

  if (secondsRemaining <= 0) {
    return (
      <div className={`p-4 rounded-xl border border-red-500/50 bg-red-950/40 text-red-200 flex items-center gap-3 ${className}`}>
        <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse flex-shrink-0" />
        <div>
          <p className="font-semibold text-sm">Hold Expired</p>
          <p className="text-xs text-red-300">The 10-minute berth hold has expired and seats have been released back to inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl border backdrop-blur-md transition-all duration-300 ${borderColor} ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-slate-700/40"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke={strokeColor}
                strokeWidth="3.5"
                strokeDasharray="113.09"
                strokeDashoffset={113.09 - (113.09 * progressPercent) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500 ease-linear"
              />
            </svg>
            <Clock className={`w-5 h-5 absolute ${textColor} ${isUrgent ? 'animate-bounce' : ''}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium tracking-wide uppercase text-slate-300">
                Berth Hold Timer
              </span>
              {isUrgent && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-red-500/30 text-red-300 animate-pulse">
                  Expiring Soon
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Complete payment before timer expires to confirm seats</p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-2xl font-mono font-bold tracking-tight ${textColor}`}>
            {formattedTime}
          </span>
          <p className="text-[10px] text-slate-400">minutes left</p>
        </div>
      </div>

      {isUrgent && (
        <div className="mt-2 pt-2 border-t border-red-500/20 flex items-center gap-1.5 text-xs text-red-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Less than 2 minutes remaining! Complete transaction to avoid losing your berths.</span>
        </div>
      )}
    </div>
  );
};

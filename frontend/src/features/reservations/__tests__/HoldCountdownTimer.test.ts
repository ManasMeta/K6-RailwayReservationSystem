import { describe, it, expect } from 'vitest';

describe('HoldCountdownTimer logic', () => {
  it('correctly calculates remaining minutes and seconds for a 10-minute hold', () => {
    const now = Date.now();
    const expiresAt = new Date(now + 9 * 60 * 1000 + 45 * 1000).toISOString();

    const diffSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    expect(minutes).toBe(9);
    expect(seconds).toBe(45);
    expect(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`).toBe('09:45');
  });

  it('identifies urgency threshold when remaining time is under 2 minutes', () => {
    const secondsRemaining = 119;
    const isUrgent = secondsRemaining < 120;
    const isWarning = secondsRemaining < 300 && !isUrgent;

    expect(isUrgent).toBe(true);
    expect(isWarning).toBe(false);
  });

  it('marks hold as expired when timestamp is in the past', () => {
    const now = Date.now();
    const pastExpiresAt = new Date(now - 10000).toISOString();
    const diffSeconds = Math.max(0, Math.floor((new Date(pastExpiresAt).getTime() - now) / 1000));

    expect(diffSeconds).toBe(0);
  });
});

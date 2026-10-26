import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TatkalCountdown, parseOpeningTime } from '../components/TatkalCountdown';

describe('parseOpeningTime', () => {
  it('reads the time booking_rules returns', () => {
    expect(parseOpeningTime('09:30:00', true)).toEqual({ hour: 9, minute: 30 });
    expect(parseOpeningTime('11:15', false)).toEqual({ hour: 11, minute: 15 });
  });

  it('falls back to the plan defaults: 10:00 for AC, 11:00 for non-AC', () => {
    expect(parseOpeningTime(undefined, true)).toEqual({ hour: 10, minute: 0 });
    expect(parseOpeningTime(undefined, false)).toEqual({ hour: 11, minute: 0 });
    expect(parseOpeningTime('not a time', true)).toEqual({ hour: 10, minute: 0 });
    expect(parseOpeningTime('10:75', false)).toEqual({ hour: 11, minute: 0 });
  });
});

describe('TatkalCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down to the configured opening time on the day before travel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T08:00:00'));

    render(<TatkalCountdown runDate="2026-11-03" classCode="3A" isAc opensAt="09:30:00" />);

    expect(screen.getByText(/at 09:30 IST \(AC class\)/)).toBeInTheDocument();
    // 2026-11-02 09:30 is 25 h 30 min after 2026-11-01 08:00
    expect(screen.getByLabelText('Opens in 25 hours 30 minutes')).toBeInTheDocument();
  });

  it('shows booking open once the time has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T12:00:00'));

    render(<TatkalCountdown runDate="2026-11-03" classCode="SL" opensAt="11:00:00" />);

    expect(screen.getByText('Tatkal booking is active')).toBeInTheDocument();
  });
});

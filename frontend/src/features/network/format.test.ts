import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatClock,
  formatDateTimeClock,
  formatDuration,
  formatRunningDays,
} from "./format";

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(1030)).toBe("17h 10m");
    expect(formatDuration(-5)).toBe("0m");
  });

  it("reads clock times without time-zone shifts", () => {
    expect(formatDateTimeClock("2026-11-03T10:05:00")).toBe("10:05");
    expect(formatClock("16:55:00")).toBe("16:55");
    expect(formatClock(null)).toBe("—");
  });

  it("counts calendar days between date-times", () => {
    expect(daysBetween("2026-11-02T16:55:00", "2026-11-03T10:05:00")).toBe(1);
    expect(daysBetween("2026-11-02T08:00:00", "2026-11-02T20:00:00")).toBe(0);
    expect(daysBetween("2026-10-31T23:00:00", "2026-11-01T01:00:00")).toBe(1);
  });

  it("describes running days", () => {
    expect(formatRunningDays([1, 2, 3, 4, 5, 6, 7])).toBe("Daily");
    expect(formatRunningDays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(formatRunningDays([])).toBe("Not scheduled");
  });
});

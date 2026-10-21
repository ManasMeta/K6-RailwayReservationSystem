const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 1030 -> "17h 10m", 45 -> "45m", 120 -> "2h". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "2026-11-02T16:55:00" -> "16:55" (no time-zone conversion: timetable times are local). */
export function formatDateTimeClock(iso: string): string {
  return iso.slice(11, 16);
}

/** "16:55:00" -> "16:55"; null -> "—". */
export function formatClock(time: string | null): string {
  return time ? time.slice(0, 5) : "—";
}

/** "2026-11-02" or an ISO date-time -> "Mon, 2 Nov". */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Whole calendar days between two ISO date-times (arrival day minus departure day). */
export function daysBetween(fromIso: string, toIso: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

/** ISO weekday numbers (1 = Monday) -> "Daily" or "Mon, Wed, Fri". */
export function formatRunningDays(days: number[]): string {
  if (days.length === 7) return "Daily";
  if (days.length === 0) return "Not scheduled";
  return days.map((d) => WEEKDAYS[d - 1]).join(", ");
}

/** Local calendar date as YYYY-MM-DD, `offsetDays` from today. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

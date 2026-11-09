/**
 * Local calendar days as plain numbers, for usage summaries. A day number is
 * the local date counted from 1970-01-01, so it ignores time zones and
 * daylight-saving shifts; consecutive days differ by exactly one.
 */
export interface CalendarDate { year: number; month: number; day: number }

const DAY = 86_400_000;

export function dayNumber(year: number, month: number, day: number) {
  return Date.UTC(year, month, day) / DAY;
}

/** The local calendar day a timestamp falls on. */
export function localDay(timestamp: number) {
  const date = new Date(timestamp);
  return dayNumber(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calendarDate(number: number): CalendarDate {
  const date = new Date(number * DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** `YYYY-MM-DD`, stable for keys and tests. */
export function dayKey(number: number) {
  const { year, month, day } = calendarDate(number);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A finite, positive timestamp, or undefined. */
export function validTime(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

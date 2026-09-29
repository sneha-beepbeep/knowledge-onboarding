// Calendar-date helpers shared by the Worker and the browser.
// Dates are ISO `YYYY-MM-DD` strings. Working days are Monday to Friday, with
// no holiday calendar (design spec decision 11).

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The calendar date of `ms` in timezone `tz`. */
export function dateInTz(ms: number, tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function isWeekend(iso: string): boolean {
  const day = toUtc(iso).getUTCDay();
  return day === 0 || day === 6;
}

/** The date `n` working days after `iso` (Mon–Fri). `iso` itself is day 0. */
export function addWorkingDays(iso: string, n: number): string {
  let d = iso;
  let count = 0;
  while (count < n) {
    d = addDays(d, 1);
    if (!isWeekend(d)) count++;
  }
  return d;
}

/**
 * Working days from `from` to `to`: the number of Mon–Fri dates in (from, to].
 * Negative when `to` is before `from`. Zero when equal.
 */
export function workingDaysBetween(from: string, to: string): number {
  if (from === to) return 0;
  const sign = to > from ? 1 : -1;
  const [a, b] = sign === 1 ? [from, to] : [to, from];
  let count = 0;
  let d = a;
  while (d < b) {
    d = addDays(d, 1);
    if (!isWeekend(d)) count++;
  }
  return sign * count;
}

/** "Tue 6 Oct" (design spec §5 conventions). */
export function formatDate(iso: string): string {
  const d = toUtc(iso);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const mon = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${wd} ${d.getUTCDate()} ${mon}`;
}

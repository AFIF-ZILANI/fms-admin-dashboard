const DAY_MS = 24 * 60 * 60 * 1000;

/** A stored farm date (midnight UTC of that calendar day, e.g. "2026-09-06T00:00:00Z") as a day count. */
const storedDay = (iso: string) => Math.round(Date.parse(iso.slice(0, 10)) / DAY_MS);
/** The browser's own calendar day -- the farm's day, not UTC's. */
const localDay = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);

/** Which day of the batch it is, the farm's way: the placement day is Day 1, the next calendar day Day 2.
 *  Counted in calendar days, so it ticks over at midnight. Same rule as the mobile app and the server. */
export function cycleDay(startingDate: string, now: Date = new Date()): number {
  return Math.max(1, localDay(now) - storedDay(startingDate) + 1);
}

/** The start of a given batch day (Day 1 = the placement date). */
export function dayStart(startingDate: string, day: number): Date {
  const d = new Date(startingDate);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

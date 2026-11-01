import { DAY_MS, farmDayNumber } from "../../lib/farm-day";

/** A stored farm date (midnight UTC of that calendar day, e.g. "2026-09-06T00:00:00Z") as a day count. */
const storedDay = (iso: string) => Math.round(Date.parse(iso.slice(0, 10)) / DAY_MS);

/** Which day of the batch it is, the farm's way: the placement day is Day 1, the next farm day Day 2.
 *  Ticks over at the farm's day start (Settings → Farm day). Same rule as the mobile app and the server. */
export function cycleDay(startingDate: string, now: Date = new Date()): number {
  return Math.max(1, farmDayNumber(now) - storedDay(startingDate) + 1);
}

/** The start of a given batch day (Day 1 = the placement date). */
export function dayStart(startingDate: string, day: number): Date {
  const d = new Date(startingDate);
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d;
}

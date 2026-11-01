/** The farm runs on Bangladesh time (UTC+6, no daylight saving) -- whatever zone the browser is in. */
const FARM_UTC_OFFSET_HOURS = 6;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Farm-local hour (0-6) the farm day starts at; from /auth/me, set by AuthProvider. Same rule as the
 * server's lib/farm-day.ts: with 4, 01:30 still belongs to the previous farm day. */
let dayStartHour = 0;
export const getDayStartHour = () => dayStartHour;
export function setDayStartHour(hour: number) {
  dayStartHour = hour;
}

/** The farm day an instant falls on, as a whole-day count since the epoch. */
export const farmDayNumber = (d: Date) =>
  Math.floor((d.getTime() + (FARM_UTC_OFFSET_HOURS - dayStartHour) * 3_600_000) / DAY_MS);

/** Today's farm date as "YYYY-MM-DD", the default for a date field. */
export const farmToday = (now: Date = new Date()) => new Date(farmDayNumber(now) * DAY_MS).toISOString().slice(0, 10);

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "CLEANING_SUPPLIES" -> "Cleaning Supplies" — every enum label in the app reads off this one function. */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Money/quantity fields come back as JSON strings (docs/api.md §1.9) — parse
 * before formatting. No currency symbol yet: default currency isn't decided
 * (docs/PRD.md §6.15 lists it as an open Settings field).
 */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** formatMoney with the taka sign -- every amount of money on the dashboard. A loss reads "-৳1,200". */
export function formatTk(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value
  return n < 0 ? `-৳${formatMoney(-n)}` : `৳${formatMoney(n)}`
}

/** Short taka for chart axes: "৳12K", "৳1.5M". */
export function formatTkCompact(value: number): string {
  const short = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Math.abs(value))
  return value < 0 ? `-৳${short}` : `৳${short}`
}

/** Round to the cents money columns store (Decimal(10,2)) -- float sums like 0.1 + 0.2 drift past them. */
export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sale/purchase dates are stored as UTC midnight (a Zod `coerce.date()` of a
 * "YYYY-MM-DD" input), so rendering them in local time shows the previous day
 * for any negative UTC offset. Always read these back in UTC. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" })
}

/** Epoch ms for `days` days ago. A function, not inline, so render code can call it without tripping the purity lint. */
export function daysAgoMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

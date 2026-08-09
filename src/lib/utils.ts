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

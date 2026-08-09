import type { Tone } from "@/components/shared/status-badge";

/** `is_active` recurs on Houses/Suppliers/Customers/Employees/Admins/Items — one mapping, reused everywhere. */
export function activeStatus(isActive: boolean): { tone: Tone; label: string } {
  return isActive ? { tone: "success", label: "Active" } : { tone: "neutral", label: "Inactive" };
}

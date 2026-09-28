import type { Tone } from "@/components/shared/status-badge";
import type { AllocationType, AssetStatus, StockUnitStatus } from "@/pages/inventory/types";
import type { EmploymentStatus, PayoutStatus } from "@/pages/employees/types";

/** `is_active` recurs on Houses/Suppliers/Customers/Employees/Admins/Items — one mapping, reused everywhere. */
export function activeStatus(isActive: boolean): { tone: Tone; label: string } {
  return isActive ? { tone: "success", label: "Active" } : { tone: "neutral", label: "Inactive" };
}

/** Shared across coded-units-tab.tsx and stock-unit-detail-sheet.tsx -- keeping it here (rather than exported from a tab component) avoids a module cycle between the two. */
export const STOCK_UNIT_STATUS_TONE: Record<StockUnitStatus, Tone> = {
  UNASSIGNED: "info",
  IN_STOCK: "success",
  IN_USE: "info",
  CONSUMED: "neutral",
  DISPOSED: "neutral",
};

/** Shared across assets-tab.tsx and asset-detail-sheet.tsx. */
export const ASSET_STATUS_TONE: Record<AssetStatus, Tone> = {
  ACTIVE: "success",
  RETIRED: "neutral",
  DISPOSED: "neutral",
};

/** Shared across stock-allocation-tab.tsx and stock-allocation-form-dialog.tsx. */
export const ALLOCATION_TYPE_TONE: Record<AllocationType, Tone> = {
  ALLOCATION: "success",
  REALLOCATION: "info",
  RETURN: "warning",
};

/** Shared across the employee roster table and the employee detail header. */
export const EMPLOYMENT_STATUS_TONE: Record<EmploymentStatus, Tone> = {
  APPOINTED: "info",
  PROBATION: "warning",
  CONFIRMED: "success",
  TERMINATED: "neutral",
};

/** Shared across the payroll history table and the payout dialog. */
export const PAYOUT_STATUS_TONE: Record<PayoutStatus, Tone> = {
  PENDING: "warning",
  SENT: "info",
  FAILED: "critical",
  CONFIRMED: "success",
};

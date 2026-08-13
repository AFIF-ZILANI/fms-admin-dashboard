import type { Tone } from "@/components/shared/status-badge";
import type { AssetStatus, StockUnitStatus } from "@/pages/inventory/types";

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

import type { Tone } from "@/components/shared/status-badge";
import type { SaleKind } from "@/pages/sales/types";

export const SALE_KIND_LABEL: Record<SaleKind, string> = {
  CODED: "QR items",
  STOCK: "Bought stock",
  FARM_MADE: "Farm-made",
};

type KindedItem = { is_unit_tracked: boolean; is_farm_made: boolean; category: string };

/** Mirrors the server's rule: QR sales take QR-tracked items except equipment (selling it needs its asset retired,
 *  not built yet), farm-made sales take farm-made items, bought stock takes everything else. */
export function itemFitsKind(item: KindedItem, kind: SaleKind): boolean {
  if (kind === "CODED") return item.is_unit_tracked && item.category !== "EQUIPMENT";
  if (kind === "FARM_MADE") return item.is_farm_made;
  return !item.is_unit_tracked && !item.is_farm_made;
}

/** "3 of 5 scanned" until every pack of a QR sale is out; nothing for other kinds. */
export function scanLabel(scan: { needed: number; scanned: number } | null): { tone: Tone; label: string } | null {
  if (!scan) return null;
  if (scan.scanned >= scan.needed) return { tone: "success", label: "Scanned" };
  return { tone: "warning", label: `${scan.scanned} of ${scan.needed} scanned` };
}

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

/** False once any chosen line is an item of another kind -- the form asks before switching kinds then. */
export function linesValidForKind(
  lines: { item_id: string }[],
  items: (KindedItem & { id: string })[],
  kind: SaleKind
): boolean {
  return lines.every((line) => {
    if (!line.item_id) return true;
    const item = items.find((i) => i.id === line.item_id);
    return !item || itemFitsKind(item, kind);
  });
}

/** "3 of 5 scanned" until every bottle of a QR sale is out; nothing for other kinds. */
export function scanLabel(scan: { needed: number; scanned: number } | null): { tone: Tone; label: string } | null {
  if (!scan) return null;
  if (scan.scanned >= scan.needed) return { tone: "success", label: "Scanned" };
  return { tone: "warning", label: `${scan.scanned} of ${scan.needed} scanned` };
}

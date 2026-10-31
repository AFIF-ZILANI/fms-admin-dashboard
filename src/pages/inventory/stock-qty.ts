import { humanizeEnum } from "../../lib/utils";
import type { Item } from "./types";

function formatQty(n: number) {
  return String(Number(n.toFixed(3)));
}

/** A stock total in the item's base unit, e.g. "12.5 kg". When the item has a Bag conversion
 * (feed), it reads in whole bags plus the loose remainder instead: "3 Bag 12.5 kg". */
export function formatStock(total: number, item: Pick<Item, "unit" | "itemUnits">) {
  const base = humanizeEnum(item.unit).toLowerCase();
  const bagSize = Number(item.itemUnits?.find((u) => u.unit === "BAG")?.factor_to_base ?? 0);
  if (item.unit === "BAG" || bagSize <= 0) return `${formatQty(total)} ${base}`;
  // epsilon so 150 at 50/bag is 3 bags, not 2 bags 50 kg from float drift
  const bags = Math.floor(total / bagSize + 1e-9);
  const loose = Number((total - bags * bagSize).toFixed(3));
  if (bags === 0) return `${formatQty(loose)} ${base}`;
  return loose > 0 ? `${bags} Bag ${formatQty(loose)} ${base}` : `${bags} Bag`;
}

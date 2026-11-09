import { humanizeEnum } from "../../lib/utils";
import type { Item } from "./types";

function formatQty(n: number) {
  return String(Number(n.toFixed(3)));
}

/** An item's Bag size in its base unit (50 for a 50 kg feed bag), or 0 when it isn't sold in bags. */
export function bagSize(item: Pick<Item, "unit" | "itemUnits">) {
  if (item.unit === "BAG") return 0;
  return Number(item.itemUnits?.find((u) => u.unit === "BAG")?.factor_to_base ?? 0);
}

/** A stock amount in the item's base unit, e.g. "12.5 kg". An item with a Bag conversion (feed) always
 * reads in whole bags plus the loose remainder -- "3 Bag 12.5 kg", "3 Bag", "0 Bag 20 kg" -- never bare kg. */
export function formatStock(total: number | string, item: Pick<Item, "unit" | "itemUnits">) {
  const n = Number(total);
  const base = humanizeEnum(item.unit).toLowerCase();
  const size = bagSize(item);
  if (size <= 0) return `${formatQty(n)} ${base}`;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  // epsilon so 150 at 50/bag is 3 bags, not 2 bags 50 kg from float drift
  const bags = Math.floor(abs / size + 1e-9);
  const loose = Number((abs - bags * size).toFixed(3));
  return loose > 0 ? `${sign}${bags} Bag ${formatQty(loose)} ${base}` : `${sign}${bags} Bag`;
}

/** A quantity as entered (a purchase line, a draw): in the base unit it reads like stock; in any other
 * unit ("10 Bag", "2 Container") it stays as entered. */
export function formatEntered(quantity: number | string, unit: string, item: Pick<Item, "unit" | "itemUnits"> | undefined) {
  if (item && unit === item.unit) return formatStock(quantity, item);
  if (unit === "BAG") return `${formatQty(Number(quantity))} Bag`;
  return `${formatQty(Number(quantity))} ${humanizeEnum(unit).toLowerCase()}`;
}

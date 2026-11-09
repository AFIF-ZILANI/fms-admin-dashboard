import { useGetData, type Paginated } from "@/lib/api";
import { formatEntered, formatStock } from "@/pages/inventory/stock-qty";
import type { Item } from "@/pages/inventory/types";

/** For rows that carry only item_id + unit (house stock, low stock, ledger...): looks the item up in the
 *  cached catalog so feed reads "X Bag Y kg" everywhere. Until the catalog loads it falls back to the unit. */
export function useFormatStock() {
  const { data } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const byId = new Map((data?.results ?? []).map((i) => [i.id, i]));
  return {
    stock: (amount: number | string, itemId: string, unit: string) =>
      formatStock(amount, byId.get(itemId) ?? { unit, itemUnits: [] }),
    entered: (quantity: number | string, unit: string, itemId: string) =>
      formatEntered(quantity, unit, byId.get(itemId)),
  };
}

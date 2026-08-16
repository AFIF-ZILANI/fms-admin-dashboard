import type { Asset } from "@/pages/inventory/types";

export function bookValue(asset: Asset): number {
  const depreciated = (asset.depreciations ?? []).reduce((sum, d) => sum + parseFloat(d.amount), 0);
  return parseFloat(asset.purchase_cost) - depreciated;
}

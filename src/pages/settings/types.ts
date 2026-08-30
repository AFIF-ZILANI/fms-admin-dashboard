export const STOCK_UNIT_STATUSES = ["UNASSIGNED", "IN_STOCK", "IN_USE", "CONSUMED", "DISPOSED"] as const;
export type StockUnitStatus = (typeof STOCK_UNIT_STATUSES)[number];

export type StockUnit = {
  id: string;
  purchase_item_id: string | null;
  status: StockUnitStatus;
  bound_at: string | null;
  created_at: string;
};

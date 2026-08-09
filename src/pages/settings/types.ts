export const STOCK_UNIT_STATUSES = ["UNASSIGNED", "IN_STOCK", "IN_USE", "CONSUMED", "DISPOSED"] as const;
export type StockUnitStatus = (typeof STOCK_UNIT_STATUSES)[number];

export type StockUnit = {
  id: string;
  code: string;
  purchase_item_id: string | null;
  status: StockUnitStatus;
  initial_quantity: string | null;
  remaining_quantity: string | null;
  house_id: string | null;
  bound_by_id: string | null;
  bound_at: string | null;
  created_at: string;
};

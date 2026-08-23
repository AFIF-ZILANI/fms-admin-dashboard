import type { House } from "@/pages/houses/types";
import type { PurchaseItemLine } from "@/pages/purchases/types";

export const ORGANIZATION_ROLES = ["MANUFACTURER", "IMPORTER", "MARKETER", "DISTRIBUTOR"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ITEM_BASE_UNITS = ["ML", "G", "UNIT", "DOSE", "PCS", "METER"] as const;

/** Units valid as an ItemUnit conversion under ANY base-unit family (Container can package a
 * liquid or a solid). Mirrors the backend allowlist (item.service.ts) -- not every unit with a
 * null base_unit is generic (e.g. BIRD is a legacy code unrelated to item purchasing). */
export const GENERIC_ITEM_UNITS = new Set(["CONTAINER"]);

/** GET /units row -- the generic LookupRow shape plus the base-unit hierarchy fields (Unit-only,
 * not shared with the other lookup tables). base_unit/fixed_factor are null for the 6 base units
 * themselves and for generic cross-family package units (e.g. Container). */
export type UnitRow = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  is_base: boolean;
  base_unit: string | null;
  fixed_factor: string | null;
};

export type ItemUnit = {
  id: string;
  item_id: string;
  unit: string;
  factor_to_base: string;
  is_purchasable: boolean;
  is_usable: boolean;
};

export type Item = {
  id: string;
  name: string;
  normalized_key: string;
  category: string;
  unit: string;
  reorder_level: string | null;
  preferred_reorder_qty: string | null;
  lead_time_days: number | null;
  meta_data: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  itemUnits?: ItemUnit[];
};

export type Warehouse = {
  id: string;
  name: string;
  created_at: string;
};

export type Organization = {
  id: string;
  label_name: string;
  normalized_key: string;
  created_at: string;
  itemLinks?: { item: Item; role: OrganizationRole }[];
};

export type LowStockItem = Item & { current_balance: string };

export const STOCK_UNIT_STATUSES = ["UNASSIGNED", "IN_STOCK", "IN_USE", "CONSUMED", "DISPOSED"] as const;
export type StockUnitStatus = (typeof STOCK_UNIT_STATUSES)[number];

export const ASSET_STATUSES = ["ACTIVE", "RETIRED", "DISPOSED"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const STOCK_DIRECTIONS = ["IN", "OUT"] as const;
export type StockDirection = (typeof STOCK_DIRECTIONS)[number];

export const STOCK_REASONS = [
  "PURCHASE",
  "TRANSFER",
  "CONSUMPTION",
  "WASTAGE",
  "EXPIRED",
  "ADJUSTMENT",
  "OPENING_BALANCE",
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

/** A purchase-item lot as returned by `GET /api/purchase-items` -- unlike `PurchaseItemLine` (nested under one Purchase's own `items[]`), this carries the parent Purchase back so a lot can be identified out of context (the Bind Code flow). */
export type PurchaseItemOption = PurchaseItemLine & {
  purchase: { id: string; purchase_date: string; invoice_no: string | null };
};

export type AssetDepreciation = {
  id: string;
  asset_id: string;
  batch_id: string;
  amount: string;
  computed_at: string;
  batch?: { id: string; batch_code: string };
};

export type Asset = {
  id: string;
  stock_unit_id: string;
  name: string;
  purchase_cost: string;
  purchase_date: string;
  useful_life_batches: number;
  status: AssetStatus;
  created_at: string;
  stock_unit?: StockUnit;
  depreciations?: AssetDepreciation[];
};

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
  purchase_item: PurchaseItemLine | null;
  house: House | null;
  asset: Asset | null;
};

export type StockLedgerEntry = {
  id: string;
  item_id: string;
  quantity: string;
  direction: StockDirection;
  reason: StockReason;
  unit_cost: string | null;
  location_type: "WAREHOUSE" | "HOUSE" | "DISPOSAL" | null;
  location_id: string | null;
  ref_type: "PURCHASE" | "CONSUMPTION" | "ADJUSTMENT";
  ref_id: string;
  occurred_at: string;
  item: Item;
};

export type InventoryAdjustment = {
  id: string;
  item_id: string;
  warehouse_id: string | null;
  house_id: string | null;
  quantity_before: string;
  quantity_after: string;
  adjustment_quantity: string;
  reason: string;
  note: string | null;
  recorded_by_id: string;
  created_at: string;
  item: Item;
};

export type Consumption = {
  id: string;
  batch_id: string | null;
  house_id: string;
  item_id: string;
  stock_unit_id: string | null;
  quantity: string;
  date: string;
  note: string | null;
  recorded_by_id: string;
  created_at: string;
  batch: { id: string; batch_code: string } | null;
  house: House;
  item: Item;
  stock_unit: StockUnit | null;
};

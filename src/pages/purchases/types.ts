import type { Unit } from "@/pages/inventory/types";

export type PurchaseItemLine = {
  id: string;
  purchase_id: string;
  item_id: string;
  batch_id: string | null;
  quantity: string;
  unit: Unit;
  unit_price: string;
  total_price: string;
  mfg_date: string | null;
  expiration_date: string | null;
  item: { id: string; name: string; category: string; unit: Unit };
};

export type Purchase = {
  id: string;
  supplier_id: string | null;
  invoice_no: string | null;
  purchase_date: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  recorded_by_id: string;
  created_at: string;
  items: PurchaseItemLine[];
  // Purchase's `include` nests the Supplier row itself, but not its Profile —
  // unlike GET /api/suppliers, this has no `name`/`mobile`. Look those up
  // separately (see supplierName() usage in the list/detail pages).
  supplier: { id: string; company: string | null } | null;
};

export const BIRD_GRADES = ["HIGH", "LOW", "CULL"] as const;
export type BirdGrade = (typeof BIRD_GRADES)[number];

export type SaleItemLine = {
  id: string;
  sale_id: string;
  item_id: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
  item: { id: string; name: string; category: string; unit: string };
};

export type Sale = {
  id: string;
  customer_id: string | null;
  sale_date: string;
  total: string;
  paid_amount: string;
  due_amount: string;
  recorded_by_id: string;
  created_at: string;
  items: SaleItemLine[];
  // Sale's `include` is `customer: true` — the flat Customers row, no nested
  // Profile (same gotcha as Purchase.supplier). Look names up separately.
  customer: { id: string; company: string | null } | null;
};

export type BirdSale = {
  id: string;
  batch_id: string;
  house_id: string;
  customer_id: string | null;
  sale_date: string;
  grade: BirdGrade;
  male_count: number | null;
  female_count: number | null;
  birds_count: number;
  dholta_in_g: string;
  total_katha: number;
  avg_wt_per_katha_kg: string | null;
  total_weight: string;
  net_weight: string;
  avg_weight_g: string | null;
  price_per_kg: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
  recorded_by_id: string;
  created_at: string;
  // getAll/getById return the flat BirdSale row — no batch/house/customer
  // relations included. Look names up separately, same pattern as Purchases.
};

export type PaymentStatusInfo = { tone: "success" | "warning" | "neutral"; label: string };

/** Paid/Partial/Unpaid is computed client-side from paid/due, never stored --
 * both Sale and BirdSale are append-only records with no status enum of their own. */
export function paymentStatus(paid: string, due: string): PaymentStatusInfo {
  const dueNum = parseFloat(due);
  const paidNum = parseFloat(paid);
  if (dueNum <= 0) return { tone: "success", label: "Paid" };
  if (paidNum > 0) return { tone: "warning", label: "Partial" };
  return { tone: "neutral", label: "Unpaid" };
}

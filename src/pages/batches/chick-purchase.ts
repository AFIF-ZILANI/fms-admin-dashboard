import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { Supplier } from "@/pages/suppliers/types";
import type { Purchase } from "@/pages/purchases/types";

/**
 * Chicks are bought only from a batch (batch-management-design.md §3): the delivery that starts it on
 * New batch, any later one with "Add chick delivery" on the batch page. Either way it is a normal
 * Purchase whose one line carries the batch's id, so its cost lands in the batch P&L. The Purchases
 * page leaves chicks out of its item list.
 */

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
};

export type ChickPurchase = {
  supplier_id: string;
  invoice_no: string;
  /** "" = the default count the caller passes (the chicks placed, on New batch). */
  billed: string;
  unit_price: string;
  status: PaymentStatus;
  amount: string;
  from_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
};

export const CHICK_ITEM_NAME = "Day-old chick";

export const blankChickPurchase = (today: string): ChickPurchase => ({
  supplier_id: "",
  invoice_no: "",
  billed: "",
  unit_price: "",
  status: "UNPAID",
  amount: "",
  from_instrument_id: "",
  payment_date: today,
  transaction_ref: "",
});

/** The numbers a chick purchase works out to. `defaultBilled` fills an empty "Chicks billed". */
export function chickTotals(chicks: ChickPurchase, defaultBilled: number) {
  const billed = chicks.billed === "" ? defaultBilled : Number(chicks.billed);
  const unitPrice = Number(chicks.unit_price);
  const total = Number.isFinite(billed * unitPrice) ? Math.round(billed * unitPrice * 100) / 100 : 0;
  const paymentAmount = chicks.status === "PAID" ? total : Number(chicks.amount);
  return { billed, unitPrice, total, paymentAmount };
}

/** What's wrong with the purchase/payment, checked before anything is saved. */
export function chickProblem(chicks: ChickPurchase, defaultBilled: number, hasWarehouse: boolean): string | null {
  const { billed, unitPrice, total, paymentAmount } = chickTotals(chicks, defaultBilled);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return "Enter the price per chick.";
  if (!Number.isInteger(billed) || billed <= 0) return "Enter how many chicks were billed.";
  if (!hasWarehouse) return "Add a warehouse first — every purchase is filed under one.";
  if (chicks.status !== "UNPAID") {
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return "Enter a valid payment amount.";
    if (chicks.status === "PARTIAL" && paymentAmount >= total)
      return 'A partial payment must be less than the total — pick "Paid in full" instead.';
    if (!chicks.from_instrument_id) return "Select which account the payment came from.";
  }
  return null;
}

/** Everything a chick purchase needs from the server, and the call that records one for a batch. */
export function useChickPurchase() {
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: chickItems } = useGetData<Paginated<Item>>("/items?category=CHICKS&limit=100", ["items", "CHICKS"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const createItem = usePostData<Item, Record<string, unknown>>("/items", ["items"]);
  const createPurchase = usePostData<Purchase, Record<string, unknown>>("/purchases", ["purchases"]);
  const chickItem = chickItems?.results.find((i) => i.is_active) ?? null;

  const record = async (batchId: string, chicks: ChickPurchase, defaultBilled: number, purchaseDate: string) => {
    const { billed, unitPrice, paymentAmount } = chickTotals(chicks, defaultBilled);
    const item =
      chickItem ?? (await createItem.mutateAsync({ name: CHICK_ITEM_NAME, category: "CHICKS", unit: "PCS" }));
    const paying = chicks.status !== "UNPAID";
    return createPurchase.mutateAsync({
      supplier_id: chicks.supplier_id || undefined,
      // Chick lines post no warehouse stock; the purchase is just filed under the first warehouse.
      warehouse_id: warehouses!.results[0]!.id,
      invoice_no: chicks.invoice_no.trim() || undefined,
      purchase_date: purchaseDate,
      paid_amount: paying ? paymentAmount : 0,
      ...(paying && {
        paid_from_instrument_id: chicks.from_instrument_id,
        payment_date: chicks.payment_date || undefined,
        payment_transaction_ref: chicks.transaction_ref.trim() || undefined,
      }),
      items: [{ item_id: item.id, batch_id: batchId, quantity: billed, unit: item.unit, unit_price: unitPrice }],
    });
  };

  return { suppliers, chickItem, hasWarehouse: !!warehouses?.results.length, record };
}

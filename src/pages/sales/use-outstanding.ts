import { useGetData, type Paginated } from "@/lib/api";
import type { PaymentRefType } from "@/pages/payments/types";

type PaymentLite = { ref_id: string; amount: string };

function sumByRef(payments: PaymentLite[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of payments) {
    map.set(p.ref_id, (map.get(p.ref_id) ?? 0) + parseFloat(p.amount));
  }
  return map;
}

/** Sale/BirdSale/Purchase's own paid_amount/due_amount are create-time
 * snapshots (server/src/services/payment.service.ts) -- Payment rows
 * recorded afterward never mutate them. This nets actual payments against
 * the snapshot so every paid/due figure reflects reality, matching the
 * same convention PaymentCreateDialog's own "Remaining due" display
 * already uses (GET /payments/total-paid).
 *
 * PAYROLL has no snapshot of its own (PayrollRecord stores only
 * final_salary) -- callers pass snapshotPaid="0" and snapshotDue=final_salary
 * so the whole record starts as due, same as PaymentCreateDialog's ref
 * options already treat it. */
export function useOutstanding(refType: Extract<PaymentRefType, "SALE" | "BIRD_SALE" | "PURCHASE" | "PAYROLL">) {
  const { data, isLoading } = useGetData<Paginated<PaymentLite>>(`/payments?ref_type=${refType}&limit=100`, [
    "payments",
    refType,
  ]);
  const paidByRef = sumByRef(data?.results ?? []);

  return {
    isLoading,
    /** Returns the true paid/due for one row, given its snapshot fields. */
    trueAmounts(id: string, snapshotPaid: string, snapshotDue: string): { paid: string; due: string } {
      const extra = paidByRef.get(id) ?? 0;
      const total = parseFloat(snapshotPaid) + parseFloat(snapshotDue);
      const paid = parseFloat(snapshotPaid) + extra;
      const due = Math.max(0, total - paid);
      return { paid: String(paid), due: String(due) };
    },
  };
}

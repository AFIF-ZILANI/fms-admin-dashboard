import { useGetData } from "@/lib/api";
import type { PaymentRefType } from "@/pages/payments/types";

type PaidByRefRow = { ref_id: string; total_paid: string };

/** Sale/BirdSale/Purchase's own paid_amount/due_amount are create-time
 * snapshots (server/src/services/payment.service.ts) -- Payment rows
 * recorded afterward never mutate them. This nets actual payments against
 * the snapshot so every paid/due figure reflects reality, matching the
 * same convention PaymentCreateDialog's own "Remaining due" display
 * already uses (GET /payments/total-paid).
 *
 * Payroll is not here: a salary payment is a PayrollPayout, which carries its
 * own status rather than a running paid/due balance. Previously PayrollRecord
 * had no snapshot of its own (it stored only
 * total_pay) -- callers pass snapshotPaid="0" and snapshotDue=total_pay
 * so the whole record starts as due, same as PaymentCreateDialog's ref
 * options already treat it.
 *
 * Totals come from GET /payments/outstanding, which is unpaginated -- a
 * limit=100 list fetch silently dropped older payments, so any sale whose
 * payments fell off that page reverted to looking unpaid. */
export function useOutstanding(refType: Extract<PaymentRefType, "SALE" | "BIRD_SALE" | "PURCHASE">) {
  const { data, isLoading, isError } = useGetData<PaidByRefRow[]>(
    `/payments/outstanding?ref_type=${refType}`,
    ["payments", "outstanding", refType]
  );
  const paidByRef = new Map((data ?? []).map((row) => [row.ref_id, parseFloat(row.total_paid)]));

  return {
    isLoading,
    isError,
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

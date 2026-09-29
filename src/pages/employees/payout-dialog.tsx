import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import {
  PAYOUT_METHOD_LABELS,
  type EmployeePayoutAccount,
  type PayoutFeeRates,
  type PayrollRecord,
} from "@/pages/employees/types";
import { useQueryClient } from "@tanstack/react-query";

const accountLabel = (a: EmployeePayoutAccount | undefined) =>
  a ? `${PAYOUT_METHOD_LABELS[a.method]} · ${a.account_name} · ${a.account_number}` : "";

type PayoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  record: PayrollRecord | null;
};

/**
 * Pays a generated payroll. Creating the payout and confirming it are one
 * action here, but two writes on the server — the confirm is the one that
 * demands proof, and it refuses without it.
 */
export function PayoutDialog({ open, onOpenChange, employeeId, record }: PayoutDialogProps) {
  const queryClient = useQueryClient();
  // An account id, not a method: a method on its own can't be paid to, so the
  // options are this employee's own accounts and nothing else. Wages are never
  // paid in cash -- there would be nothing to audit.
  const [accountId, setAccountId] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: accounts } = useGetData<Paginated<EmployeePayoutAccount>>(
    `/employee-payout-accounts?employee_id=${employeeId}&active_only=true`,
    ["employee-payout-accounts", employeeId],
    { enabled: open }
  );
  const activeAccounts = accounts?.results ?? [];

  // Reset when the dialog opens on a different record, adjusted during render
  // rather than in an effect — React's own "reset state on prop change" pattern,
  // the same one ItemFormPage and EmployeeFormPage use.
  const resetKey = open ? `${record?.id ?? ""}:${activeAccounts[0]?.id ?? ""}` : null;
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setAccountId(activeAccounts[0]?.id ?? "");
    setTransactionRef("");
  }

  const { data: feeRates } = useGetData<PayoutFeeRates>(
    "/payroll-payouts/fee-rates",
    ["payroll-payout-fee-rates"],
    { enabled: open }
  );

  const account = activeAccounts.find((a) => a.id === accountId);
  const wage = Number(record?.total_pay ?? 0);
  const rate = account && feeRates ? feeRates[account.method] : undefined;
  // Preview only. The server derives the figure it stores from the same table,
  // so this never becomes the number of record.
  const fee = rate ? rate.flat + (wage * rate.percent) / 100 : null;

  const onConfirm = async () => {
    if (!record) return;
    setBusy(true);
    try {
      // Reuse an existing PENDING payout rather than creating a second one —
      // a payroll record can only ever carry one.
      const existing = await apiFetch<Paginated<{ id: string }>>(
        `/payroll-payouts?employee_id=${employeeId}&limit=100`
      );
      const found = (existing.results as Array<{ id: string; payroll_record: { id: string } }>).find(
        (p) => p.payroll_record.id === record.id
      );

      const payout =
        found ??
        (await apiFetch<{ id: string }>("/payroll-payouts", {
          method: "POST",
          body: JSON.stringify({
            payroll_record_id: record.id,
            payout_account_id: accountId,
          }),
        }));

      await apiFetch(`/payroll-payouts/${payout.id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ transaction_ref: transactionRef }),
      });

      toast.success("Payout confirmed");
      void queryClient.invalidateQueries({ queryKey: ["payroll-payouts"] });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm the payout");
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = !!account && !!transactionRef.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payout</DialogTitle>
          <DialogDescription>
            {record
              ? `${formatMoney(record.total_pay)} for ${new Date(record.month).toLocaleDateString(undefined, { year: "numeric", month: "long" })}.`
              : ""}{" "}
            A payout can't be confirmed without proof of transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-method">Pay to</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="payout-method" className="w-full">
                <SelectValue>
                  {(v: string) =>
                    accountLabel(activeAccounts.find((a) => a.id === v)) || "No payout account"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeAccounts.length === 0 && (
              <p className="text-xs text-destructive">
                No payout account on file for this employee — add one on their profile before
                paying. Wages aren't paid in cash.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn">Transaction reference</Label>
            <Input
              id="txn"
              placeholder="bKash TrxID or bank reference"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
            />
          </div>

          {account && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">To the employee</span>
                <span className="tabular-nums">{formatMoney(wage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Transfer fee · {PAYOUT_METHOD_LABELS[account.method]}
                  {rate ? ` (${rate.percent ? `${rate.percent}%` : "flat"})` : ""}
                </span>
                <span className="tabular-nums">{fee === null ? "—" : formatMoney(fee)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                <span>Farm pays</span>
                <span className="tabular-nums">{formatMoney(wage + (fee ?? 0))}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                The employee receives the full {formatMoney(wage)} — the fee is on top, and is
                recorded as a Salary transfer fee expense when you confirm.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onConfirm()} disabled={busy || !canConfirm}>
            Confirm payout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

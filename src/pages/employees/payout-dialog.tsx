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
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  type EmployeePayoutAccount,
  type PayoutMethod,
  type PayrollRecord,
} from "@/pages/employees/types";
import { useQueryClient } from "@tanstack/react-query";

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
  const [method, setMethod] = useState<PayoutMethod>("BKASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [feePaid, setFeePaid] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: accounts } = useGetData<Paginated<EmployeePayoutAccount>>(
    `/employee-payout-accounts?employee_id=${employeeId}&active_only=true`,
    ["employee-payout-accounts", employeeId],
    { enabled: open }
  );
  const activeAccount = accounts?.results[0] ?? null;

  // Reset when the dialog opens on a different record, adjusted during render
  // rather than in an effect — React's own "reset state on prop change" pattern,
  // the same one ItemFormPage and EmployeeFormPage use.
  const resetKey = open ? `${record?.id ?? ""}:${activeAccount?.id ?? ""}` : null;
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setMethod(activeAccount?.method ?? "CASH");
    setTransactionRef("");
    setReceiptUrl("");
    setFeePaid("");
  }

  const isCash = method === "CASH";

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
            method,
            account_number: activeAccount?.account_number ?? "CASH",
            ...(feePaid ? { fee_paid_by_farm: Number(feePaid) } : {}),
          }),
        }));

      await apiFetch(`/payroll-payouts/${payout.id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify(
          isCash ? { receipt_doc_url: receiptUrl } : { transaction_ref: transactionRef }
        ),
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

  const canConfirm = isCash ? !!receiptUrl.trim() : !!transactionRef.trim();

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
            <Label htmlFor="payout-method">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
              <SelectTrigger id="payout-method" className="w-full">
                <SelectValue>{(v: string) => PAYOUT_METHOD_LABELS[v as PayoutMethod]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYOUT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {activeAccount
                ? `On file: ${activeAccount.account_name} · ${activeAccount.account_number}`
                : "No payout account on file for this employee."}
            </p>
          </div>

          {isCash ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receipt">Signed receipt</Label>
              <Input
                id="receipt"
                placeholder="Link to the receipt they signed"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cash is a documented exception — a signed receipt is required.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn">Transaction reference</Label>
              <Input
                id="txn"
                placeholder="bKash TrxID or bank reference"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
              />
            </div>
          )}

          {!isCash && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee">Cash-out fee covered by the farm (optional)</Label>
              <Input id="fee" inputMode="decimal" value={feePaid} onChange={(e) => setFeePaid(e.target.value)} />
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

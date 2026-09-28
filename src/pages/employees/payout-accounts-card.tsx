import { useState } from "react";
import { Banknote, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { PayoutAccountDialog } from "@/pages/employees/payout-account-dialog";
import {
  PAYOUT_METHOD_LABELS,
  type EmployeePayoutAccount,
} from "@/pages/employees/types";

/**
 * Where this employee's wage goes, and everywhere it went before. Accounts are
 * append-only on the server, so this reads as a history with one row in force —
 * there is deliberately no edit action.
 */
export function PayoutAccountsCard({ employeeId }: { employeeId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data } = useGetData<Paginated<EmployeePayoutAccount>>(
    `/employee-payout-accounts?employee_id=${employeeId}&limit=50`,
    ["employee-payout-accounts", employeeId]
  );
  const accounts = data?.results ?? [];
  const active = accounts.find((a) => a.active_to === null) ?? null;
  const closed = accounts.filter((a) => a.active_to !== null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Payout account</CardTitle>
        <Button size="sm" variant={active ? "outline" : "default"} onClick={() => setDialogOpen(true)}>
          <Plus />
          {active ? "Replace" : "Add account"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {active ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">
                {PAYOUT_METHOD_LABELS[active.method]} · {active.account_number}
              </p>
              <p className="text-sm text-muted-foreground">
                {active.account_name}
                {active.bank_name ? ` · ${active.bank_name}` : ""}
                {active.branch_name ? `, ${active.branch_name}` : ""}
              </p>
              {active.holder_relation && (
                <p className="mt-1 text-xs text-warning">
                  Third-party account ({active.holder_relation}) — consent on file
                </p>
              )}
            </div>
            <StatusBadge tone="success" label="In force" />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 py-2">
            <Banknote className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No payout account on file — payroll can't be paid to them yet.
            </p>
          </div>
        )}

        {closed.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Previously</p>
            <ul className="flex flex-col gap-1.5">
              {closed.map((a) => (
                <li key={a.id} className="flex justify-between text-sm text-muted-foreground">
                  <span className="truncate">
                    {PAYOUT_METHOD_LABELS[a.method]} · {a.account_number}
                  </span>
                  <span className="shrink-0 text-xs">
                    closed {new Date(a.active_to!).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <PayoutAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        replacing={active}
      />
    </Card>
  );
}

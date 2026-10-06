import { Award, Banknote, CreditCard, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { PayrollPayout, PayrollRecord, PerformanceScoreEntry } from "@/pages/employees/types";

type TimelineRow = {
  id: string;
  date: string;
  icon: typeof Award;
  label: string;
  amount: string;
  amountClassName: string;
};

type EmployeeActivityTimelineProps = {
  scoreEntries: PerformanceScoreEntry[];
  payrollRecords: PayrollRecord[];
  employeeId: string;
};

/** Merges score entries + payroll runs + payouts this employee received
 * into one chronological feed -- the detailed tables below still carry
 * per-type columns (score criterion, payroll breakdown), this is just the
 * fast at-a-glance view a farm owner scrolls through. */
export function EmployeeActivityTimeline({
  scoreEntries,
  payrollRecords,
  employeeId,
}: EmployeeActivityTimelineProps) {
  // Wage and bonus money lives in EmployeePayout, not the generic Payment ledger.
  const { data: payouts, isLoading } = useGetData<Paginated<PayrollPayout>>(
    `/payroll-payouts?employee_id=${employeeId}&limit=100`,
    ["payroll-payouts", employeeId]
  );

  const scoreRows: TimelineRow[] = scoreEntries.map((e) => ({
    id: `score-${e.id}`,
    date: e.incident_date,
    icon: Award,
    label: e.reason,
    amount: `${e.points > 0 ? "+" : ""}${e.points} pts`,
    amountClassName: e.points >= 0 ? "text-success" : "text-critical",
  }));

  const payrollRows: TimelineRow[] = payrollRecords.map((p) => ({
    id: `payroll-${p.id}`,
    date: p.month,
    icon: Banknote,
    label: "Payroll run",
    amount: formatMoney(p.total_pay),
    amountClassName: "",
  }));

  const payoutRows: TimelineRow[] = (payouts?.results ?? [])
    .filter((p) => p.paid_at !== null)
    .map((p) => ({
      id: `payout-${p.id}`,
      date: p.paid_at!,
      icon: CreditCard,
      label: p.bonus ? `Bonus paid · ${p.bonus.event.name}` : "Wage paid",
      amount: formatMoney(p.amount),
      amountClassName: "text-success",
    }));

  const rows = [...scoreRows, ...payrollRows, ...payoutRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && rows.length === 0 && (
          <EmptyState icon={History} title="No activity yet" description="Score entries, payroll runs, and payments will show up here." />
        )}
        {!isLoading && rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <r.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {new Date(r.date).toLocaleDateString()}
                </span>
                <span className="flex-1">{r.label}</span>
                <span className={`font-medium tabular-nums ${r.amountClassName}`}>{r.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

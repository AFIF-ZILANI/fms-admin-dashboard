import {
  AlertTriangle,
  Banknote,
  Bird,
  CalendarClock,
  ClipboardList,
  FileWarning,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { EmployeeKpis } from "@/pages/employees/types";
import { EmployeesAnalytics } from "@/pages/employees/employees-analytics";
import { EmployeesTableSection } from "@/pages/employees/employees-table-section";

export function EmployeesListPage() {
  usePageTitle("Employees");

  // One server-computed call over the whole table. Deliberately not derived from
  // the table's own paged fetch — that would only ever see 20 employees.
  const { data, isLoading, isError } = useGetData<EmployeeKpis>("/employees/kpis", [
    "employees",
    "kpis",
  ]);

  const tile = { isLoading, isError } as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Money: what is going out, and what is already owed. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Wage bill this month"
          value={formatMoney(data?.wage_bill_projected ?? 0)}
          icon={Banknote}
          hint={`${data?.active_employees ?? 0} active · projected with allowances`}
          {...tile}
        />
        <KPICard
          label="Unpaid wages"
          value={formatMoney(data?.unpaid_wages ?? 0)}
          icon={WalletCards}
          tone={data?.payout_overdue ? "critical" : data?.unpaid_wages ? "warning" : undefined}
          hint={
            data?.unpaid_runs
              ? `${data.unpaid_runs} payroll run${data.unpaid_runs === 1 ? "" : "s"}${data.payout_overdue ? " · past the 7th" : ""}`
              : "all settled"
          }
          {...tile}
        />
        <KPICard
          label="Labour cost per bird"
          value={data?.labour_cost_per_bird == null ? "—" : formatMoney(data.labour_cost_per_bird)}
          icon={Bird}
          hint={
            data?.live_birds
              ? `${formatMoney(data.last_month_wages)} last month · ${data.live_birds.toLocaleString()} birds`
              : "no live birds recorded"
          }
          {...tile}
        />
        <KPICard
          label="Payroll not generated"
          value={data?.payroll_missing ?? 0}
          icon={FileWarning}
          tone={data?.payroll_missing ? "warning" : undefined}
          hint="for last month"
          {...tile}
        />
      </div>

      {/* People: what is waiting on a decision from you. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Can't be paid"
          value={data ? `${data.no_payout_account} of ${data.active_employees}` : "—"}
          icon={AlertTriangle}
          tone={data?.no_payout_account ? "critical" : undefined}
          hint="no payout account on file"
          {...tile}
        />
        <KPICard
          label="Probation decisions"
          value={data?.probation_due ?? 0}
          icon={CalendarClock}
          tone={data?.probation_due ? "warning" : undefined}
          hint="ending within 7 days"
          {...tile}
        />
        <KPICard
          label="Negative performers"
          value={data?.negative_performers ?? 0}
          icon={TrendingDown}
          tone={data?.negative_performers ? "warning" : undefined}
          hint="below zero points this month"
          {...tile}
        />
        <KPICard
          label="Overdue tasks"
          value={data?.overdue_tasks ?? 0}
          icon={ClipboardList}
          tone={data?.overdue_tasks ? "warning" : undefined}
          hint="assigned, past due"
          {...tile}
        />
      </div>

      <EmployeesAnalytics />

      <EmployeesTableSection />
    </div>
  );
}

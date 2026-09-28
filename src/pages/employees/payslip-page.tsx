import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import {
  EMPLOYEE_ROLE_LABELS,
  PAYOUT_METHOD_LABELS,
  type Payslip,
} from "@/pages/employees/types";

const FARM = {
  name: "ZeroD Farms",
  address: "Kundona, Fotepur Madrasha, Mahadebpur, Naogaon 6530",
  contact: "+880 1354-711846 · farmshr@zerod.bd",
};

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "font-medium" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * What the employee is handed. Per docs/employee-payroll-design.md it must show
 * the fixed wage, the allowance, every score entry with its reason, and how it
 * was paid — the reason each entry is listed is that pay varying without a
 * stated cause is what makes a scheme feel arbitrary.
 */
export function PayslipPage() {
  const { id, payrollId } = useParams<{ id: string; payrollId: string }>();
  const navigate = useNavigate();
  usePageTitle("Payslip");

  const { data: slip, isLoading } = useGetData<Payslip>(
    `/payroll-records/${payrollId}/payslip`,
    ["payslip", payrollId ?? ""]
  );

  if (isLoading || !slip) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    );
  }

  const month = new Date(slip.month).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/employees/${id}`)}>
          <ArrowLeft />
          Back to employee
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer />
          Print
        </Button>
      </div>

      <article className="max-w-2xl rounded-lg border border-border bg-card p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-4">
          <div>
            <h1 className="text-lg font-semibold">{FARM.name}</h1>
            <p className="text-xs text-muted-foreground">{FARM.address}</p>
            <p className="text-xs text-muted-foreground">{FARM.contact}</p>
          </div>
          <div className="text-right">
            <p className="font-medium">Payslip</p>
            <p className="text-sm text-muted-foreground">{month}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 border-b border-border py-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Employee</p>
            <p className="font-medium">{slip.employee.name}</p>
            <p className="text-muted-foreground">
              {EMPLOYEE_ROLE_LABELS[slip.employee.role]} · {slip.employee.mobile}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Joined</p>
            <p>{new Date(slip.employee.joining_date).toLocaleDateString()}</p>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-b border-border py-4 text-sm">
          <Line label="Fixed wage (guaranteed)" value={formatMoney(slip.fixed_wage)} />
          <Line
            label={`Performance allowance (P ${slip.adjustment_percent > 0 ? "+" : ""}${slip.adjustment_percent})`}
            value={formatMoney(slip.allowance)}
          />
          <div className="mt-1 border-t border-border pt-2">
            <Line label="Total pay" value={formatMoney(slip.total_pay)} strong />
          </div>
        </section>

        <section className="border-b border-border py-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Performance entries this month
            {slip.score_sum !== slip.adjustment_percent && (
              <> · raw total {slip.score_sum > 0 ? "+" : ""}{slip.score_sum}, applied at the limit</>
            )}
          </p>
          {slip.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries — the allowance is the standard 10% of the reference salary.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {slip.entries.map((e) => (
                <li key={e.id} className="flex justify-between gap-4">
                  <span className="min-w-0">
                    <span className="text-muted-foreground">
                      {new Date(e.incident_date).toLocaleDateString()}
                    </span>{" "}
                    {humanizeEnum(e.criterion)} — {e.reason}
                  </span>
                  <span
                    className={`shrink-0 tabular-nums ${e.points >= 0 ? "text-success" : "text-critical"}`}
                  >
                    {e.points > 0 ? "+" : ""}
                    {e.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="py-4 text-sm">
          <p className="mb-2 text-xs text-muted-foreground">Paid</p>
          {slip.payout ? (
            <div className="flex flex-col gap-1.5">
              <Line
                label={`${PAYOUT_METHOD_LABELS[slip.payout.method]} · ····${slip.payout.account_last4}`}
                value={formatMoney(slip.payout.amount)}
              />
              {parseFloat(slip.payout.fee_paid_by_farm) > 0 && (
                <Line
                  label="Cash-out fee covered by the farm"
                  value={formatMoney(slip.payout.fee_paid_by_farm)}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {humanizeEnum(slip.payout.status)}
                {slip.payout.paid_at && ` on ${new Date(slip.payout.paid_at).toLocaleDateString()}`}
                {slip.payout.transaction_ref && ` · ref ${slip.payout.transaction_ref}`}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Not yet paid.</p>
          )}
        </section>

        <footer className="mt-4 grid grid-cols-2 gap-8 pt-8 text-xs text-muted-foreground">
          <div className="border-t border-border pt-1">Employee signature</div>
          <div className="border-t border-border pt-1">For {FARM.name}</div>
        </footer>
      </article>
    </div>
  );
}

import { Link } from "react-router";
import { ChevronDown, Layers, Split, Warehouse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import type { SharedMonth } from "@/pages/finance/types";

const longMonth = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Farm-wide running costs (electricity, rent, salaries...) and how they were shared out: each month's total
 * splits across the batches on the farm that month by bird-days -- birds alive × days. A month with no birds
 * keeps its costs as farm overhead. The same split feeds each batch's net profit on the Batch P&L tab.
 */
export function SharedCostsTab() {
  const { data, isLoading } = useGetData<SharedMonth[]>("/analytics/shared-costs", ["analytics", "shared-costs"]);
  const months = data ?? [];
  const total = months.reduce((s, m) => s + m.total, 0);
  const allocated = months.reduce((s, m) => s + m.allocated, 0);
  const overhead = months.reduce((s, m) => s + m.overhead, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Farm-wide costs" value={formatMoney(total)} icon={Layers} isLoading={isLoading} hint={`Over ${months.length} month${months.length === 1 ? "" : "s"}`} />
        <KPICard label="Shared to batches" value={formatMoney(allocated)} icon={Split} isLoading={isLoading} hint="In each batch's net profit" />
        <KPICard
          label="Farm overhead"
          value={formatMoney(overhead)}
          icon={Warehouse}
          isLoading={isLoading}
          hint="Months with no birds on the farm"
          tone={overhead > 0 ? "warning" : undefined}
        />
      </div>

      <p className="max-w-3xl text-sm text-muted-foreground">
        A farm-wide cost is shared between the batches on the farm in its month, by <strong className="font-medium text-foreground">bird-days</strong>:
        birds alive × days. A batch of 5,000 birds for the whole month carries more than one of 3,000 for half of it.
        Record these as <em>Farm-wide</em> expenses on the Expenses tab.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : months.length === 0 ? (
        <EmptyState icon={Layers} title="No farm-wide costs yet" description="Electricity, rent and other costs recorded as farm-wide appear here, split across batches." />
      ) : (
        months.map((m) => <MonthCard key={m.month} m={m} />)
      )}
    </div>
  );
}

function MonthCard({ m }: { m: SharedMonth }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{longMonth(m.month)}</CardTitle>
          <CardDescription>
            {m.batches.length === 0
              ? "No birds on the farm this month"
              : `${m.bird_days.toLocaleString()} bird-days across ${m.batches.length} batch${m.batches.length === 1 ? "" : "es"}`}
          </CardDescription>
        </div>
        <span className="text-xl font-semibold tabular-nums">{formatMoney(m.total)}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {m.batches.length > 0 && (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pb-2 text-left font-normal">Batch</th>
                <th className="pb-2 text-right font-normal">Bird-days</th>
                <th className="w-2/5 pb-2 pl-4 text-left font-normal">Share</th>
                <th className="pb-2 text-right font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {m.batches.map((b) => {
                const share = m.bird_days > 0 ? b.bird_days / m.bird_days : 0;
                return (
                  <tr key={b.batch_id} className="border-t">
                    <td className="py-2">
                      <Link to={`/finance?tab=pnl&batch=${b.batch_id}`} className="font-medium underline-offset-4 hover:underline">
                        {b.batch_code}
                      </Link>
                    </td>
                    <td className="py-2 text-right">{b.bird_days.toLocaleString()}</td>
                    <td className="py-2 pl-4">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 rounded-full bg-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${share * 100}%` }} />
                        </span>
                        <span className="w-12 text-right text-xs text-muted-foreground">{(share * 100).toFixed(1)}%</span>
                      </span>
                    </td>
                    <td className="py-2 text-right font-medium">{formatMoney(b.share)}</td>
                  </tr>
                );
              })}
              {m.overhead > 0 && (
                <tr className="border-t text-muted-foreground">
                  <td className="py-2" colSpan={3}>
                    Farm overhead
                  </td>
                  <td className="py-2 text-right">{formatMoney(m.overhead)}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {m.batches.length === 0 && (
          <p className="text-sm text-muted-foreground">All {formatMoney(m.total)} stays as farm overhead.</p>
        )}

        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
            {m.expenses.length} expense{m.expenses.length === 1 ? "" : "s"} this month
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="divide-y border-t text-sm">
            {m.expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">{e.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(e.date)}
                    {e.remarks ? `, ${e.remarks}` : ""}
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(e.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

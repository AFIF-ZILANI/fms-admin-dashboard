import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/shared/kpi-card";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData } from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { liveBirdCount, type Batch } from "@/pages/batches/types";
import type { BatchPnl } from "@/pages/finance/types";

/** One line of the P&L: label, optional note, amount. Costs render negative so the
 * column reads top-to-bottom as arithmetic, not as six unrelated cards. */
function Line({
  label,
  note,
  amount,
  sign = 1,
  emphasis,
}: {
  label: string;
  note?: string;
  amount: string;
  sign?: 1 | -1;
  emphasis?: boolean;
}) {
  const value = parseFloat(amount);
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-3", emphasis && "border-t border-border pt-4")}>
      <div>
        <p className={cn("text-sm", emphasis ? "font-semibold" : "font-medium")}>{label}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <p
        className={cn(
          "shrink-0 tabular-nums",
          emphasis ? "text-xl font-semibold" : "text-sm",
          emphasis && value < 0 && "text-critical",
          emphasis && value >= 0 && "text-success",
          !emphasis && sign === -1 && "text-muted-foreground",
        )}
      >
        {sign === -1 && value !== 0 ? "−" : ""}
        {formatMoney(Math.abs(value))}
      </p>
    </div>
  );
}

export function FinancialsTab({ batch }: { batch: Batch }) {
  const { data: pnl, isLoading, isError } = useGetData<BatchPnl>(`/analytics/batches/${batch.id}/pnl`, [
    "analytics",
    "pnl",
    batch.id,
  ]);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !pnl) {
    return <p className="text-sm text-muted-foreground">Couldn't load financials for this batch.</p>;
  }

  const revenue = parseFloat(pnl.revenue);
  const profit = parseFloat(pnl.profit);
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const live = liveBirdCount(batch);
  const costPerBird = live > 0 ? (parseFloat(pnl.purchase_cost) + parseFloat(pnl.direct_expenses) + parseFloat(pnl.depreciation_share)) / live : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Revenue" value={formatMoney(pnl.revenue)} hint="bird sales" />
        <KPICard label="Profit" value={formatMoney(pnl.profit)} hint={margin !== null ? `${margin.toFixed(1)}% margin` : "no revenue yet"} />
        <KPICard label="Cost per live bird" value={costPerBird !== null ? formatMoney(costPerBird) : "—"} hint={`${live.toLocaleString()} live birds`} />
        <KPICard label="Unallocated shared costs" value={formatMoney(pnl.shared_period_expenses_unallocated)} hint="not in profit" />
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader title="Profit & loss" description="Everything this batch earned, minus everything it cost." />
        <Card>
          <CardContent className="divide-y divide-border py-0">
            <Line label="Revenue" note="Bird sales attributed to this batch" amount={pnl.revenue} />
            <Line label="Purchase cost" note="Day-old chicks" amount={pnl.purchase_cost} sign={-1} />
            <Line label="Direct expenses" note="Feed, medicine, labour booked to this batch" amount={pnl.direct_expenses} sign={-1} />
            <Line label="Depreciation share" note="Asset depreciation allocated to this batch" amount={pnl.depreciation_share} sign={-1} />
            <Line label="Profit" amount={pnl.profit} emphasis />
          </CardContent>
        </Card>
      </div>

      {parseFloat(pnl.shared_period_expenses_unallocated) > 0 && (
        <p className="text-xs text-muted-foreground">
          Shared-period costs ({formatMoney(pnl.shared_period_expenses_unallocated)}) aren't factored into profit — the
          bird-days allocation formula that would distribute them across concurrent batches is v2, not built yet.
        </p>
      )}
    </div>
  );
}

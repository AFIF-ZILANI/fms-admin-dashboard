import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { BatchPnl } from "@/pages/finance/types";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Revenue (bird sales)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(pnl.revenue)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Purchase cost (chicks)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(pnl.purchase_cost)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Direct expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(pnl.direct_expenses)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Depreciation share</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(pnl.depreciation_share)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Shared costs (unallocated)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-muted-foreground">
            {formatMoney(pnl.shared_period_expenses_unallocated)}
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{formatMoney(pnl.profit)}</CardContent>
        </Card>
      </div>

      {parseFloat(pnl.shared_period_expenses_unallocated) > 0 && (
        <p className="text-xs text-muted-foreground">
          Shared-period costs aren't factored into profit — the bird-days allocation formula that would distribute
          them across concurrent batches is v2, not built yet.
        </p>
      )}
    </div>
  );
}

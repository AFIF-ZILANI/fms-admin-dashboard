import { useState } from "react";
import { Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { BatchPnl } from "@/pages/finance/types";

export function BatchPnlTab() {
  const [batchId, setBatchId] = useState("");

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: pnl, isLoading } = useGetData<BatchPnl>(`/analytics/batches/${batchId}/pnl`, [
    "analytics",
    "pnl",
    batchId,
  ], { enabled: !!batchId });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 max-w-xs">
        <Select value={batchId} onValueChange={(v) => setBatchId(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => batches?.results.find((b) => b.id === v)?.batch_code ?? "Select a batch"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(batches?.results ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.batch_code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!batchId && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Coins className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a batch to see its profit &amp; loss.</p>
        </div>
      )}

      {batchId && isLoading && <Skeleton className="h-64 w-full" />}

      {batchId && pnl && (
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
      )}

      {batchId && pnl && parseFloat(pnl.shared_period_expenses_unallocated) > 0 && (
        <p className="text-xs text-muted-foreground">
          Shared-period costs aren't factored into profit — the bird-days allocation formula that would distribute
          them across concurrent batches is v2, not built yet.
        </p>
      )}
    </div>
  );
}

import { Link } from "react-router";
import { AlertTriangle, Bird, Home, Layers, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import { BatchPerformanceRow } from "@/pages/analytics/batch-performance-row";
import { MortalityTrendChart } from "@/pages/analytics/mortality-trend-chart";
import type { BatchPerformance, FarmOverview } from "@/pages/analytics/types";

// ponytail: no trend charts (mortality/feed/price) or per-section CSV
// export — every trend is already a filtered list on the module that owns
// it (GET /mortality-logs, /consumptions, /weight-records all support date
// ranges), so a redundant chart endpoint here would just reshape data the
// frontend can already fetch directly. Financial dashboard and Batch P&L
// already live on the Finance page — linked below instead of duplicated.
export function AnalyticsPage() {
  usePageTitle("Analytics");

  const { data: overview, isLoading } = useGetData<FarmOverview>("/analytics/overview", ["analytics", "overview"]);
  const { data: batches, isLoading: batchesLoading } = useGetData<Paginated<Batch>>("/batches?limit=100", [
    "batches",
  ]);
  const { data: performances, isLoading: performancesLoading } = useGetData<BatchPerformance[]>(
    "/analytics/batches/performance?status=RUNNING",
    ["analytics", "batches-performance", "RUNNING"],
  );

  const alertLevels = overview?.unresolved_alerts_by_level ?? {};
  const totalUnresolvedAlerts = Object.values(alertLevels).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Active batches" value={overview?.active_batch_count ?? 0} icon={Layers} isLoading={isLoading} />
        <KPICard label="Birds alive" value={overview?.total_birds_alive ?? 0} icon={Bird} isLoading={isLoading} />
        <KPICard
          label="Houses occupied"
          value={overview ? `${overview.houses_occupied} / ${overview.houses_occupied + overview.houses_empty}` : "—"}
          icon={Home}
          isLoading={isLoading}
        />
        <KPICard label="Employees" value={overview?.employee_headcount ?? 0} icon={Users} isLoading={isLoading} />
        <KPICard label="Unresolved alerts" value={totalUnresolvedAlerts} icon={AlertTriangle} isLoading={isLoading} />
      </div>

      {totalUnresolvedAlerts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unresolved alerts by level</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6">
            {Object.entries(alertLevels).map(([level, count]) => (
              <div key={level} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{humanizeEnum(level)}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MortalityTrendChart />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Batch performance</CardTitle>
          <Button variant="outline" size="sm" render={<Link to="/finance" />} nativeButton={false}>
            Financials &amp; P&amp;L →
          </Button>
        </CardHeader>
        <CardContent>
          {!batchesLoading && !performancesLoading && (batches?.results.length ?? 0) === 0 ? (
            <EmptyState icon={Layers} title="No batches yet" description="Batch performance appears here once one exists." />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                    <TableHead className="text-right">Live / initial</TableHead>
                    <TableHead className="text-right">Mortality</TableHead>
                    <TableHead className="text-right">Latest avg weight</TableHead>
                    <TableHead>Expected selling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batches?.results ?? []).map((b) => {
                    const performance = performances?.find((p) => p.batch_id === b.id);
                    if (!performance) return null;
                    return <BatchPerformanceRow key={b.id} batch={b} performance={performance} />;
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

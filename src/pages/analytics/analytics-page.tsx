import { Link } from "react-router";
import { AlertTriangle, Bird, CalendarClock, Home, Skull, Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import type { Batch } from "@/pages/batches/types";
import { BatchPerformanceRow } from "@/pages/analytics/batch-performance-row";
import { MortalityTrendChart } from "@/pages/analytics/mortality-trend-chart";
import { FeedTrendChart } from "@/pages/analytics/feed-trend-chart";
import { BatchComparisonChart } from "@/pages/analytics/batch-comparison-chart";
import { farmKpis } from "@/pages/analytics/farm-kpis";
import type { BatchPerformance, FarmOverview } from "@/pages/analytics/types";

// See docs/analytics-dashboard-design.md for the original dashboard design. Money charts
// (revenue vs expenses, expense breakdown) live on Finance only -- this page is flock performance.
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

  const kpis = farmKpis(performances ?? []);
  const alertLevels = overview?.unresolved_alerts_by_level ?? {};
  const totalUnresolvedAlerts = Object.values(alertLevels).reduce((sum, n) => sum + n, 0);
  const criticalAlerts = alertLevels.CRITICAL ?? 0;
  const mortalityPct = kpis.mortalityRate * 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard
          label="Birds alive"
          value={(overview?.total_birds_alive ?? 0).toLocaleString()}
          hint={overview ? `${overview.active_batch_count} running batches` : undefined}
          icon={Bird}
          isLoading={isLoading}
        />
        <KPICard
          label="Mortality"
          value={`${mortalityPct.toFixed(1)}%`}
          hint="Cumulative, running batches"
          tone={mortalityPct > 5 ? "critical" : mortalityPct > 2 ? "warning" : undefined}
          icon={Skull}
          isLoading={performancesLoading}
        />
        <KPICard
          label="FCR"
          value={kpis.fcr !== null ? kpis.fcr.toFixed(2) : "—"}
          hint={
            kpis.fcr !== null
              ? `kg feed per kg gain · ${kpis.fcrBatchCount} of ${performances?.length ?? 0} batches`
              : "Log feed against a batch to compute"
          }
          icon={Wheat}
          isLoading={performancesLoading}
        />
        <KPICard
          label="Due for sale (7d)"
          value={kpis.dueBirds.toLocaleString()}
          hint={
            kpis.dueBatchCount > 0
              ? `${kpis.dueBatchCount} batches${kpis.overdueBatchCount > 0 ? ` · ${kpis.overdueBatchCount} overdue` : ""}`
              : "No batch due this week"
          }
          tone={kpis.overdueBatchCount > 0 ? "warning" : undefined}
          icon={CalendarClock}
          isLoading={performancesLoading}
        />
        <KPICard
          label="Houses occupied"
          value={overview ? `${overview.houses_occupied} / ${overview.houses_occupied + overview.houses_empty}` : "—"}
          icon={Home}
          isLoading={isLoading}
        />
        <KPICard
          label="Unresolved alerts"
          value={totalUnresolvedAlerts}
          hint={
            totalUnresolvedAlerts > 0
              ? Object.entries(alertLevels)
                  .map(([level, n]) => `${n} ${level.toLowerCase()}`)
                  .join(" · ")
              : "All clear"
          }
          tone={criticalAlerts > 0 ? "critical" : undefined}
          icon={AlertTriangle}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MortalityTrendChart />
        <FeedTrendChart />
      </div>

      <BatchComparisonChart
        batches={batches?.results ?? []}
        performances={performances ?? []}
        isLoading={batchesLoading || performancesLoading}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Batch performance (running)</CardTitle>
          <Button variant="outline" size="sm" render={<Link to="/finance" />} nativeButton={false}>
            Financials &amp; P&amp;L →
          </Button>
        </CardHeader>
        <CardContent>
          {!batchesLoading && !performancesLoading && (performances?.length ?? 0) === 0 ? (
            <EmptyState icon={Bird} title="No running batches" description="Batch performance appears here once one exists." />
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
                    <TableHead className="text-right">FCR</TableHead>
                    <TableHead className="text-right">Cost / kg</TableHead>
                    <TableHead>Expected selling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performancesLoading ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    (performances ?? []).map((p) => {
                      const batch = batches?.results.find((b) => b.id === p.batch_id);
                      return batch ? <BatchPerformanceRow key={p.batch_id} batch={batch} performance={p} /> : null;
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/utils";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { Batch } from "@/pages/batches/types";
import type { BatchPerformance } from "@/pages/analytics/types";

type BatchComparisonChartProps = {
  batches: Batch[];
  performances: BatchPerformance[];
  isLoading: boolean;
};

/** Higher is worse for all three, so every metric sorts worst → best. */
const METRICS = {
  mortality: {
    label: "Mortality",
    value: (p: BatchPerformance) => p.cumulative_mortality_rate * 100,
    format: (v: number) => `${v.toFixed(1)}%`,
    empty: "No running batches.",
  },
  fcr: {
    label: "FCR",
    value: (p: BatchPerformance) => p.fcr,
    format: (v: number) => v.toFixed(2),
    empty: "Needs feed logged against a batch (in a unit with a kg conversion) and a weighing.",
  },
  cost: {
    label: "Cost / kg",
    value: (p: BatchPerformance) => (p.cost_per_kg === null ? null : parseFloat(p.cost_per_kg)),
    format: (v: number) => formatMoney(v),
    empty: "Needs a weighing and at least one batch cost.",
  },
} as const;
type Metric = keyof typeof METRICS;

/** Semantic tone colors for mortality only -- it has fixed good/warning/critical
 * thresholds (same split as BatchPerformanceRow's badge). FCR and cost have no
 * farm-wide target yet, so they render as a plain single series. */
function mortalityTone(pct: number) {
  if (pct > 5) return "var(--color-critical)";
  if (pct > 2) return "var(--color-warning)";
  return "var(--color-success)";
}

export function BatchComparisonChart({ batches, performances, isLoading }: BatchComparisonChartProps) {
  const [metric, setMetric] = useState<Metric>("mortality");
  const m = METRICS[metric];
  const rows = useMemo(
    () =>
      performances
        .map((p) => ({ batch_code: batches.find((b) => b.id === p.batch_id)?.batch_code ?? p.batch_id, value: m.value(p) }))
        .filter((r): r is { batch_code: string; value: number } => r.value !== null)
        .sort((a, b) => b.value - a.value),
    [batches, performances, m],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Batch comparison</CardTitle>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList>
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {METRICS[key].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.length === 0 && <EmptyState icon={Scale} title={`No ${m.label} data`} description={m.empty} />}
        {!isLoading && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, rows.length * 36)}>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => m.format(v)} {...chartAxisProps} />
              <YAxis type="category" dataKey="batch_code" width={110} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(value: TooltipValueType | undefined) => [m.format(Number(value)), m.label]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {rows.map((row) => (
                  <Cell key={row.batch_code} fill={metric === "mortality" ? mortalityTone(row.value) : SINGLE_SERIES_STROKE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

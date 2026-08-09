import { useMemo } from "react";
import { Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle } from "@/pages/analytics/chart-theme";
import type { Batch } from "@/pages/batches/types";
import type { BatchPerformance } from "@/pages/analytics/types";

type BatchComparisonChartProps = {
  batches: Batch[];
  performances: BatchPerformance[];
  isLoading: boolean;
};

/** Semantic tone colors, not categorical -- mortality rate is a status
 * reading (good/warning/critical), the same three-way split
 * BatchPerformanceRow already uses for its badge. */
function toneColor(rate: number) {
  if (rate > 0.05) return "var(--color-destructive)";
  if (rate > 0.02) return "var(--chart-3)";
  return "var(--chart-1)";
}

export function BatchComparisonChart({ batches, performances, isLoading }: BatchComparisonChartProps) {
  const rows = useMemo(
    () =>
      performances
        .map((p) => ({
          batch_code: batches.find((b) => b.id === p.batch_id)?.batch_code ?? p.batch_id,
          raw_rate: p.cumulative_mortality_rate,
          mortality_rate: Number((p.cumulative_mortality_rate * 100).toFixed(1)),
        }))
        .sort((a, b) => b.mortality_rate - a.mortality_rate),
    [batches, performances],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Batch comparison — mortality rate</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.length === 0 && (
          <EmptyState icon={Scale} title="No running batches" description="Comparison appears here once a batch is running." />
        )}
        {!isLoading && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid {...chartGridProps} horizontal={false} />
              <XAxis type="number" unit="%" {...chartAxisProps} />
              <YAxis type="category" dataKey="batch_code" width={100} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(value: TooltipValueType | undefined) => [`${value}%`, "Mortality rate"]}
              />
              <Bar dataKey="mortality_rate" radius={[0, 4, 4, 0]}>
                {rows.map((row) => (
                  <Cell key={row.batch_code} fill={toneColor(row.raw_rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

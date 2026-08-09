import { useMemo, useState } from "react";
import { Wheat } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  chartAxisProps,
  chartGridProps,
  chartTooltipContentStyle,
  SINGLE_SERIES_STROKE,
} from "@/pages/analytics/chart-theme";
import type { FeedTrendPoint } from "@/pages/analytics/types";

/** Pivots [{date, unit, quantity}] into [{date, [unit]: quantity}] so each
 * unit renders as its own bar series -- quantities in different units are
 * never summed or stacked into one bar. */
function pivotByUnit(points: FeedTrendPoint[]) {
  const units = Array.from(new Set(points.map((p) => p.unit)));
  const byDate = new Map<string, Record<string, number | string>>();
  for (const point of points) {
    const row = byDate.get(point.date) ?? { date: point.date };
    row[point.unit] = parseFloat(point.quantity);
    byDate.set(point.date, row);
  }
  return { units, rows: Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date))) };
}

export function FeedTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useGetData<FeedTrendPoint[]>(`/analytics/trends/feed?days=${days}`, [
    "analytics",
    "trends",
    "feed",
    days,
  ]);

  const { units, rows } = useMemo(() => pivotByUnit(data ?? []), [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Feed consumption trend</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.length === 0 && (
          <EmptyState icon={Wheat} title="No feed drawn" description={`Nothing recorded in the last ${days} days.`} />
        )}
        {!isLoading && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="date" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} />
              {units.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {units.map((unit, i) => (
                <Bar
                  key={unit}
                  dataKey={unit}
                  name={unit}
                  fill={units.length === 1 ? SINGLE_SERIES_STROKE : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

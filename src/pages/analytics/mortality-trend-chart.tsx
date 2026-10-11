import { useState } from "react";
import { TrendingDown } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { MortalityTrendPoint } from "@/pages/analytics/types";

/** Daily deaths as a % of birds alive that morning -- a raw count can't tell a
 * bad day in a small batch from a normal day across 15,000 birds. */
export function MortalityTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useGetData<MortalityTrendPoint[]>(`/analytics/trends/mortality?days=${days}`, [
    "analytics",
    "trends",
    "mortality",
    days,
  ]);
  const rows = (data ?? []).map((p) => ({ ...p, rate_pct: p.rate * 100 }));
  const hasDeaths = rows.some((r) => r.died > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Daily mortality rate</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && !hasDeaths && (
          <EmptyState icon={TrendingDown} title="No deaths logged" description={`Nothing recorded in the last ${days} days.`} />
        )}
        {!isLoading && hasDeaths && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="date" {...chartAxisProps} />
              <YAxis {...chartAxisProps} unit="%" tickFormatter={(v: number) => v.toFixed(2)} width={56} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(_value, _name, item) => {
                  const p = item.payload as (typeof rows)[number];
                  return [`${p.rate_pct.toFixed(2)}% (${p.died} of ${p.birds_alive.toLocaleString()})`, "Died"];
                }}
              />
              <Line type="monotone" dataKey="rate_pct" name="Mortality" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

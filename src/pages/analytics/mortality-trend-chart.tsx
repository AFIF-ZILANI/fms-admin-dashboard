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

export function MortalityTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useGetData<MortalityTrendPoint[]>(`/analytics/trends/mortality?days=${days}`, [
    "analytics",
    "trends",
    "mortality",
    days,
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Mortality trend</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <EmptyState icon={TrendingDown} title="No deaths logged" description={`Nothing recorded in the last ${days} days.`} />
        )}
        {!isLoading && (data?.length ?? 0) > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={data}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="date" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipContentStyle} />
              <Line
                type="monotone"
                dataKey="died"
                name="Died"
                stroke={SINGLE_SERIES_STROKE}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

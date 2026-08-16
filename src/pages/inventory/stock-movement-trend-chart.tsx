import { useState } from "react";
import { AlertCircle, LineChart as LineChartIcon } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle } from "@/pages/analytics/chart-theme";
import type { StockMovementTrendPoint } from "@/pages/analytics/types";

const IN_COLOR = "var(--color-success)";
const OUT_COLOR = "var(--color-critical)";

export function StockMovementTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useGetData<StockMovementTrendPoint[]>(
    `/analytics/inventory/stock-movement-trend?days=${days}`,
    ["analytics", "inventory", "stock-movement-trend", days]
  );
  const rows = (data ?? []).map((r) => ({ date: r.date, in: parseFloat(r.in), out: parseFloat(r.out) }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Stock movement trend</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this chart" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={LineChartIcon}
            title="No stock movement yet"
            description={`Nothing recorded in the last ${days} days.`}
          />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="date" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="in" name="Stock in" stroke={IN_COLOR} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out" name="Stock out" stroke={OUT_COLOR} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

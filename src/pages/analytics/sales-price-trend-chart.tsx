import { useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { SalesTrendPoint } from "@/pages/analytics/types";

const MINI_HEIGHT = CHART_HEIGHT / 2 - 8;

export function SalesPriceTrendChart() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useGetData<SalesTrendPoint[]>(`/analytics/trends/sales?days=${days}`, [
    "analytics",
    "trends",
    "sales",
    days,
  ]);
  const rows = (data ?? []).map((r) => ({
    date: r.date,
    revenue: parseFloat(r.revenue),
    avg_price_per_kg: parseFloat(r.avg_price_per_kg),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Bird sales — revenue &amp; price/kg</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.length === 0 && (
          <EmptyState icon={LineChartIcon} title="No bird sales" description={`Nothing recorded in the last ${days} days.`} />
        )}
        {!isLoading && rows.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase">Revenue</p>
            <ResponsiveContainer width="100%" height={MINI_HEIGHT}>
              <LineChart data={rows}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} hide />
                <YAxis {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipContentStyle} formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs font-medium text-muted-foreground uppercase">Avg price / kg</p>
            <ResponsiveContainer width="100%" height={MINI_HEIGHT}>
              <LineChart data={rows}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="date" {...chartAxisProps} />
                <YAxis {...chartAxisProps} />
                <Tooltip contentStyle={chartTooltipContentStyle} formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))} />
                <Line type="monotone" dataKey="avg_price_per_kg" name="Avg price/kg" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

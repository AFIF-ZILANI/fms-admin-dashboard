import { AlertCircle, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { PayrollRecord } from "@/pages/employees/types";

const TRAILING_MONTHS = 12;

/** PayrollRecord.month is already monthly-granular (one row per employee
 * per month) -- unlike the day-range trend charts elsewhere, there's no
 * daily data to bucket, so this shows a fixed trailing window instead of
 * a DayRangeToggle. */
export function PayrollCostTrendChart() {
  const { data, isLoading, isError } = useGetData<Paginated<PayrollRecord>>("/payroll-records?limit=100", [
    "payroll-records",
  ]);

  const byMonth = new Map<string, number>();
  for (const r of data?.results ?? []) {
    const key = r.month.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + parseFloat(r.final_salary));
  }
  const rows = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-TRAILING_MONTHS)
    .map(([month, total]) => ({
      month: new Date(`${month}-01`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      total,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payroll cost trend</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this chart" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState icon={BarChart3} title="No payroll runs yet" description="Run payroll for an employee to see cost trends." />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))}
              />
              <Bar dataKey="total" name="Payroll cost" fill={SINGLE_SERIES_STROKE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

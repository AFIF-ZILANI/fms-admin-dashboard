import { Banknote } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle } from "@/pages/analytics/chart-theme";
import type { RevenueVsExpensesPoint } from "@/pages/analytics/types";

export function RevenueExpenseChart() {
  const { data, isLoading } = useGetData<RevenueVsExpensesPoint[]>("/analytics/revenue-vs-expenses?months=6", [
    "analytics",
    "revenue-vs-expenses",
  ]);
  const rows = (data ?? []).map((r) => ({
    month: r.month,
    revenue: parseFloat(r.revenue),
    expenses: parseFloat(r.expenses),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue vs expenses — last 6 months</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.every((r) => r.revenue === 0 && r.expenses === 0) && (
          <EmptyState icon={Banknote} title="No financial activity" description="Nothing recorded in the last 6 months." />
        )}
        {!isLoading && !rows.every((r) => r.revenue === 0 && r.expenses === 0) && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { PieChart } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { CATEGORICAL_COLORS, CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, OTHER_COLOR } from "@/pages/analytics/chart-theme";
import type { ExpenseBreakdownRow } from "@/pages/analytics/types";

const TOP_N = 4;

/** Endpoint already sorts descending by total -- fold anything past the
 * fixed 4-slot categorical order into "Other" rather than generating a
 * 5th hue (dataviz skill: categorical order is fixed, never cycled). */
function topNPlusOther(rows: ExpenseBreakdownRow[]) {
  const top = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const otherTotal = rest.reduce((sum, r) => sum + parseFloat(r.total), 0);
  const withOther = otherTotal > 0 ? [...top, { category: "OTHER", total: String(otherTotal) }] : top;
  return withOther.map((r) => ({ category: r.category, total: parseFloat(r.total) }));
}

export function ExpenseBreakdownChart() {
  const { data, isLoading } = useGetData<ExpenseBreakdownRow[]>("/analytics/expenses/breakdown", [
    "analytics",
    "expenses",
    "breakdown",
  ]);
  const rows = useMemo(() => topNPlusOther(data ?? []), [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expense breakdown — this month</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && rows.length === 0 && (
          <EmptyState icon={PieChart} title="No expenses this month" description="Breakdown appears here once expenses are logged." />
        )}
        {!isLoading && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="category" width={100} tickFormatter={humanizeEnum} {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))} labelFormatter={(label) => humanizeEnum(String(label))} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {rows.map((row, i) => (
                  <Cell key={row.category} fill={row.category === "OTHER" ? OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

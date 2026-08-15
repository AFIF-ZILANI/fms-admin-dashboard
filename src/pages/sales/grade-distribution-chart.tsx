import { AlertCircle, PieChart } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle } from "@/pages/analytics/chart-theme";
import type { GradeDistributionRow } from "@/pages/analytics/types";

const GRADE_COLOR: Record<string, string> = {
  HIGH: "var(--color-success)",
  LOW: "var(--color-warning)",
  CULL: "var(--color-critical)",
};

type GradeDistributionChartProps = { days: number };

export function GradeDistributionChart({ days }: GradeDistributionChartProps) {
  const { data, isLoading, isError } = useGetData<GradeDistributionRow[]>(
    `/analytics/sales/grade-distribution?days=${days}`,
    ["analytics", "sales", "grade-distribution", days]
  );
  const rows = (data ?? []).map((r) => ({ grade: r.grade, birds_count: r.birds_count }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grade distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this chart" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={PieChart}
            title="No bird sales yet"
            description={`Nothing recorded in the last ${days} days.`}
          />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="grade" {...chartAxisProps} />
              <YAxis allowDecimals={false} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => `${v} birds`}
              />
              <Bar dataKey="birds_count" radius={[4, 4, 0, 0]}>
                {rows.map((row) => (
                  <Cell key={row.grade} fill={GRADE_COLOR[row.grade] ?? "var(--color-muted-foreground)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

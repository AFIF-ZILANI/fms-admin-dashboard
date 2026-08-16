import { AlertCircle, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  chartAxisProps,
  chartGridProps,
  chartTooltipContentStyle,
  OTHER_COLOR,
} from "@/pages/analytics/chart-theme";
import type { ConsumptionByCategoryRow } from "@/pages/analytics/types";

type ConsumptionByCategoryChartProps = { days: number };

export function ConsumptionByCategoryChart({ days }: ConsumptionByCategoryChartProps) {
  const { data, isLoading, isError } = useGetData<ConsumptionByCategoryRow[]>(
    `/analytics/inventory/consumption-by-category?days=${days}`,
    ["analytics", "inventory", "consumption-by-category", days]
  );
  const rows = (data ?? []).map((r) => ({ category: r.category, total: parseFloat(r.total) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consumption by category</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this chart" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title="No consumption logged"
            description={`Nothing recorded in the last ${days} days.`}
          />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows} layout="vertical">
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="category" width={90} tickFormatter={humanizeEnum} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))}
                labelFormatter={(label) => humanizeEnum(String(label))}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {rows.map((row, i) => (
                  <Cell
                    key={row.category}
                    fill={row.category === "OTHER" ? OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

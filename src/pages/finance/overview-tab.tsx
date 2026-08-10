import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  chartAxisProps,
  chartGridProps,
  chartTooltipContentStyle,
  OTHER_COLOR,
} from "@/pages/analytics/chart-theme";
import type { FinancialDashboard } from "@/pages/finance/types";

export function OverviewTab() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useGetData<FinancialDashboard>(`/analytics/financial?month=${month}-01`, [
    "analytics",
    "financial",
    month,
  ]);

  const instrumentRows = useMemo(() => {
    const rows = data?.cash_by_instrument ?? [];
    const top = rows.slice(0, 4);
    const rest = rows.slice(4);
    const otherTotal = rest.reduce((sum, r) => sum + parseFloat(r.balance), 0);
    const withOther = rest.length > 0 ? [...top, { instrument_id: "other", label: "Other", balance: String(otherTotal) }] : top;
    return withOther.map((r) => ({ label: r.label, balance: parseFloat(r.balance) }));
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 max-w-[10rem]">
        <Label htmlFor="month">Month</Label>
        <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Revenue" value={data ? formatMoney(data.revenue) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Expenses" value={data ? formatMoney(data.expenses) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Gross profit" value={data ? formatMoney(data.gross_profit) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard
          label="Outstanding payables"
          value={data ? formatMoney(data.outstanding_payables) : "—"}
          icon={Wallet}
          isLoading={isLoading}
        />
        <KPICard
          label="Outstanding receivables"
          value={data ? formatMoney(data.outstanding_receivables) : "—"}
          icon={Wallet}
          isLoading={isLoading}
        />
        <KPICard label="Cash position" value={data ? formatMoney(data.cash_position) : "—"} icon={Wallet} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash by instrument</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
          {!isLoading && (data?.cash_by_instrument.length ?? 0) === 0 && (
            <EmptyState icon={Wallet} title="No payment instruments yet" />
          )}
          {!isLoading && (data?.cash_by_instrument.length ?? 0) > 0 && (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={instrumentRows} layout="vertical">
                <CartesianGrid {...chartGridProps} vertical horizontal={false} />
                <XAxis type="number" {...chartAxisProps} />
                <YAxis type="category" dataKey="label" width={120} {...chartAxisProps} />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  formatter={(v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v))}
                />
                <Bar dataKey="balance" radius={[0, 4, 4, 0]}>
                  {instrumentRows.map((row, i) => (
                    <Cell key={row.label} fill={row.label === "Other" ? OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

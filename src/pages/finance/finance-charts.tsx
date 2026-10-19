import { useState, type ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney } from "@/lib/utils";
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  chartAxisProps,
  chartGridProps,
  chartTooltipContentStyle,
  OTHER_COLOR,
  SINGLE_SERIES_STROKE,
} from "@/pages/analytics/chart-theme";
import type { CostLine, FinanceMonth } from "@/pages/finance/types";

// Fixed identity across the page's charts: money in / revenue is always the first hue, money out / costs the
// second, the resulting line (profit, cash balance) the third. Never cycled, never by rank.
const IN_COLOR = CATEGORICAL_COLORS[0];
const OUT_COLOR = CATEGORICAL_COLORS[1];
const RESULT_COLOR = CATEGORICAL_COLORS[2];

const money = (v: TooltipValueType | undefined) => formatMoney(typeof v === "number" ? v : Number(v));
/** "2026-10" -> "Oct 26" for the axis; the tooltip shows the full month. */
const shortMonth = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });
const longMonth = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
/** Compact axis ticks: 2,500,000 -> 2.5M. Values elsewhere are always full figures. */
const compact = (v: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** Every chart here can be read as a table too: exact figures, and a way around colour for anyone who needs it. */
function ChartCard({
  title,
  description,
  isLoading,
  isEmpty,
  emptyText,
  chart,
  table,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  chart: ReactNode;
  table: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "chart" | "table")}>
          <TabsList>
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />
        ) : isEmpty ? (
          <EmptyState icon={BarChart3} title="Nothing to show yet" description={emptyText} />
        ) : view === "chart" ? (
          chart
        ) : (
          <div className="max-h-[260px] overflow-y-auto">{table}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MoneyTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h, i) => (
            <TableHead key={h} className={i > 0 ? "text-right" : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={String(r[0])}>
            {r.map((c, i) => (
              <TableCell key={i} className={i > 0 ? "text-right tabular-nums" : undefined}>
                {typeof c === "number" ? formatMoney(c) : c}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const legendProps = { iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: 12 } };
/** Legend in the order the marks are drawn (bars, then the line) -- recharts sorts it alphabetically otherwise. */
const legendIn = (order: string[]) => ({ ...legendProps, itemSorter: (item: { value?: unknown }) => order.indexOf(String(item.value)) });

/** Revenue and costs per month as bars, profit as a line -- all one money axis. */
export function ProfitTrendChart({ rows, isLoading }: { rows: FinanceMonth[]; isLoading: boolean }) {
  const isEmpty = rows.every((r) => r.revenue === 0 && r.costs === 0);
  return (
    <ChartCard
      title="Profit trend"
      description="Revenue, costs and profit per month"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyText="No sales or costs in the last 12 months."
      chart={
        <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
          <ComposedChart data={rows} barGap={2} margin={{ left: 4, right: 4 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="month" tickFormatter={shortMonth} {...chartAxisProps} />
            <YAxis tickFormatter={compact} width={48} {...chartAxisProps} />
            <Tooltip contentStyle={chartTooltipContentStyle} labelFormatter={(m) => longMonth(String(m))} formatter={money} />
            <Legend {...legendIn(["Revenue", "Costs", "Profit"])} />
            <Bar dataKey="revenue" name="Revenue" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="costs" name="Costs" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line type="monotone" dataKey="profit" name="Profit" stroke={RESULT_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      }
      table={
        <MoneyTable
          head={["Month", "Revenue", "Costs", "Profit"]}
          rows={[...rows].reverse().map((r) => [longMonth(r.month), r.revenue, r.costs, r.profit])}
        />
      }
    />
  );
}

/** Money in and out of the farm's accounts per month, with the balance they leave behind. */
export function CashFlowChart({ rows, isLoading }: { rows: FinanceMonth[]; isLoading: boolean }) {
  const isEmpty = rows.every((r) => r.cash_in === 0 && r.cash_out === 0);
  return (
    <ChartCard
      title="Cash flow"
      description="Money received and paid out per month, and the balance at month end"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyText="No payments recorded in the last 12 months."
      chart={
        <ResponsiveContainer width="100%" height={CHART_HEIGHT + 40}>
          <ComposedChart data={rows} barGap={2} margin={{ left: 4, right: 4 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="month" tickFormatter={shortMonth} {...chartAxisProps} />
            <YAxis tickFormatter={compact} width={48} {...chartAxisProps} />
            <Tooltip contentStyle={chartTooltipContentStyle} labelFormatter={(m) => longMonth(String(m))} formatter={money} />
            <Legend {...legendIn(["Money in", "Money out", "Balance"])} />
            <Bar dataKey="cash_in" name="Money in" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="cash_out" name="Money out" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line type="monotone" dataKey="cash_end" name="Balance" stroke={RESULT_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      }
      table={
        <MoneyTable
          head={["Month", "Money in", "Money out", "Balance"]}
          rows={[...rows].reverse().map((r) => [longMonth(r.month), r.cash_in, r.cash_out, r.cash_end])}
        />
      }
    />
  );
}

const TOP_COSTS = 7;

/** Where the period's costs went, largest first; the tail folds into "Other". One series, one colour. */
export function CostBreakdownChart({ lines, isLoading }: { lines: CostLine[]; isLoading: boolean }) {
  const shown = lines.slice(0, TOP_COSTS).map((l) => ({ label: l.label, amount: l.amount, other: false }));
  const rest = lines.slice(TOP_COSTS).reduce((sum, l) => sum + l.amount, 0);
  if (rest > 0) shown.push({ label: "Other", amount: rest, other: true });
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return (
    <ChartCard
      title="Where the money went"
      description="Costs in this period by category"
      isLoading={isLoading}
      isEmpty={lines.length === 0}
      emptyText="No costs in this period."
      chart={
        <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, shown.length * 34 + 20)}>
          <BarChart data={shown} layout="vertical" margin={{ left: 4, right: 56 }}>
            <CartesianGrid {...chartGridProps} vertical horizontal={false} />
            <XAxis type="number" tickFormatter={compact} {...chartAxisProps} />
            <YAxis type="category" dataKey="label" width={130} {...chartAxisProps} />
            <Tooltip
              contentStyle={chartTooltipContentStyle}
              formatter={(v: TooltipValueType | undefined) => {
                const n = typeof v === "number" ? v : Number(v);
                return [`${formatMoney(n)} (${total ? Math.round((n / total) * 100) : 0}%)`, "Cost"];
              }}
            />
            <Bar
              dataKey="amount"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              shape={(props: unknown) => {
                const p = props as { x: number; y: number; width: number; height: number; payload: { other: boolean } };
                return (
                  <rect x={p.x} y={p.y} width={Math.max(0, p.width)} height={p.height} rx={4} fill={p.payload.other ? OTHER_COLOR : SINGLE_SERIES_STROKE} />
                );
              }}
              label={{
                position: "right",
                fontSize: 12,
                fill: "var(--color-muted-foreground)",
                formatter: (v: unknown) => compact(Number(v)),
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      }
      table={
        <MoneyTable
          head={["Category", "Amount", "Share"]}
          rows={lines.map((l) => [l.label, l.amount, `${total ? ((l.amount / total) * 100).toFixed(1) : 0}%`])}
        />
      }
    />
  );
}

import { Fragment } from "react";
import { Link, useSearchParams } from "react-router";
import { Coins, ExternalLink } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData } from "@/lib/api";
import { cn, formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, OTHER_COLOR, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { BatchStatement, StatementSection } from "@/pages/finance/types";

const SECTION_ORDER: StatementSection[] = ["CHICKS", "FEED", "HEALTH", "SUPPLIES", "DIRECT", "DEPRECIATION"];
const SECTION_LABEL: Record<StatementSection, string> = {
  CHICKS: "Chicks",
  FEED: "Feed",
  HEALTH: "Medicine & vaccines",
  SUPPLIES: "Bedding & supplements",
  DIRECT: "Direct expenses",
  DEPRECIATION: "Equipment depreciation",
};
const STATUS_TONE = { RUNNING: "info", SOLD: "success", CLOSED: "neutral" } as const;

const totalCost = (s: BatchStatement) => s.costs + s.shared_costs.total;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const maybe = (v: number | null, suffix = "") => (v === null ? "—" : `${formatMoney(v)}${suffix}`);
/** Per bird sold only means something once the batch is sold: mid-batch, costs for every bird sit against the
 * few sold so far. */
const profitPerBird = (s: BatchStatement) => (s.batch.status === "RUNNING" ? null : s.per_unit.profit_per_bird);

export function BatchPnlTab() {
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useGetData<BatchStatement[]>("/analytics/batches-pnl", ["analytics", "batches-pnl"]);
  const statements = data ?? [];
  // Default to the most recent batch that has sold birds: a running one with no sales has little to say yet.
  const selectedId =
    params.get("batch") ?? statements.find((s) => s.revenue.net > 0)?.batch.id ?? statements[0]?.batch.id ?? "";
  const selected = statements.find((s) => s.batch.id === selectedId);
  const select = (id: string) =>
    setParams(
      (p) => {
        p.set("batch", id);
        return p;
      },
      { replace: true },
    );

  const columns: Column<BatchStatement>[] = [
    {
      key: "batch",
      header: "Batch",
      render: (s) => (
        <span className="flex flex-col">
          <span className={cn("font-medium", s.batch.id === selectedId && "text-primary")}>{s.batch.batch_code}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(s.batch.starting_date)}, {s.batch.age_days} days
          </span>
        </span>
      ),
      sortValue: (s) => s.batch.starting_date,
    },
    { key: "status", header: "Status", render: (s) => <StatusBadge tone={STATUS_TONE[s.batch.status]} label={humanizeEnum(s.batch.status)} /> },
    { key: "birds", header: "Birds sold / placed", render: (s) => `${s.birds.sold.toLocaleString()} / ${s.birds.placed.toLocaleString()}`, numeric: true, sortValue: (s) => s.birds.sold },
    { key: "mortality", header: "Mortality", render: (s) => pct(s.birds.mortality_rate), numeric: true, sortValue: (s) => s.birds.mortality_rate },
    { key: "revenue", header: "Revenue", render: (s) => formatMoney(s.revenue.net), numeric: true, sortValue: (s) => s.revenue.net },
    { key: "cost", header: "Total cost", render: (s) => formatMoney(totalCost(s)), numeric: true, sortValue: totalCost },
    {
      key: "profit",
      header: "Net profit",
      render: (s) => <span className={cn("font-medium", s.net_profit < 0 && "text-critical")}>{formatMoney(s.net_profit)}</span>,
      numeric: true,
      sortValue: (s) => s.net_profit,
    },
    { key: "per_bird", header: "Profit / bird", render: (s) => maybe(profitPerBird(s)), numeric: true, sortValue: (s) => profitPerBird(s) ?? -Infinity },
    { key: "per_kg", header: "Cost / kg", render: (s) => maybe(s.per_unit.cost_per_kg), numeric: true, sortValue: (s) => s.per_unit.cost_per_kg ?? Infinity },
    { key: "fcr", header: "FCR", render: (s) => (s.per_unit.fcr === null ? "—" : s.per_unit.fcr.toFixed(2)), numeric: true, sortValue: (s) => s.per_unit.fcr ?? Infinity },
    { key: "margin", header: "Margin", render: (s) => pct(s.margin), numeric: true, sortValue: (s) => s.margin ?? -Infinity },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All batches</CardTitle>
          <CardDescription>
            Net profit includes each batch&apos;s share of farm-wide costs. Running batches show their figures so far. Pick a
            batch to see its full statement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={statements}
            rowKey={(s) => s.batch.id}
            isLoading={isLoading}
            onRowClick={(s) => select(s.batch.id)}
            empty={{ icon: Coins, title: "No batches yet", description: "A batch's profit and loss appears here once it starts." }}
          />
        </CardContent>
      </Card>

      {statements.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CompareChart
            title="Profit per bird sold"
            description="Net profit divided by birds sold, for finished batches"
            rows={statements.filter((s) => profitPerBird(s) !== null).map((s) => ({ id: s.batch.id, label: s.batch.batch_code, value: profitPerBird(s)! }))}
            selectedId={selectedId}
          />
          <CompareChart
            title="Cost per kg produced"
            description="All costs divided by kg sold plus live weight on hand"
            rows={statements.filter((s) => s.per_unit.cost_per_kg !== null).map((s) => ({ id: s.batch.id, label: s.batch.batch_code, value: s.per_unit.cost_per_kg! }))}
            selectedId={selectedId}
          />
        </div>
      )}

      {isLoading ? <Skeleton className="h-96 w-full" /> : selected ? <Statement s={selected} /> : null}
    </div>
  );
}

/** One measure across batches, one colour; the selected batch is the darker bar. */
function CompareChart({ title, description, rows, selectedId }: { title: string; description: string; rows: { id: string; label: string; value: number }[]; selectedId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={Coins} title="Nothing to compare yet" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT / 1.5, rows.length * 40 + 30)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 56 }}>
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="label" width={130} {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} formatter={(v: TooltipValueType | undefined) => [formatMoney(typeof v === "number" ? v : Number(v)), title]} />
              <Bar dataKey="value" radius={4} maxBarSize={18} label={{ position: "right", fontSize: 12, fill: "var(--color-muted-foreground)", formatter: (v: unknown) => formatMoney(Number(v)) }}>
                {rows.map((r) => (
                  <Cell key={r.id} fill={r.id === selectedId ? SINGLE_SERIES_STROKE : OTHER_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** The statement, top to bottom, adding up line by line -- with each line's share of revenue. */
function Statement({ s }: { s: BatchStatement }) {
  const running = s.batch.status === "RUNNING";
  const ofRevenue = (v: number) => (s.revenue.net > 0 ? `${((v / s.revenue.net) * 100).toFixed(1)}%` : "");
  const sections = SECTION_ORDER.map((sec) => ({
    sec,
    lines: s.cost_lines.filter((l) => l.section === sec),
  })).filter((x) => x.lines.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {s.batch.batch_code}
            <StatusBadge tone={STATUS_TONE[s.batch.status]} label={humanizeEnum(s.batch.status)} />
          </h2>
          <p className="text-sm text-muted-foreground">
            {humanizeEnum(s.batch.breed)}, started {formatDate(s.batch.starting_date)}
            {s.batch.actual_end_date ? `, ended ${formatDate(s.batch.actual_end_date)}` : ""}, {s.batch.age_days} days
            {running ? ". Still running: figures so far." : ""}
          </p>
        </div>
        <Link to={`/batches/${s.batch.id}`} className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open batch <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label={running ? "Net profit so far" : "Net profit"} value={formatMoney(s.net_profit)} tone={s.net_profit < 0 ? "critical" : undefined} hint={s.margin === null ? "No sales yet" : `${pct(s.margin)} of revenue`} />
        <KPICard
          label="Profit per bird"
          value={maybe(profitPerBird(s))}
          hint={running ? "Shown once the batch is sold" : `${s.birds.sold.toLocaleString()} birds sold`}
        />
        <KPICard label="Cost per kg" value={maybe(s.per_unit.cost_per_kg)} hint={s.per_unit.avg_price_per_kg === null ? undefined : `Sold at ${formatMoney(s.per_unit.avg_price_per_kg)} / kg`} />
        <KPICard label="FCR" value={s.per_unit.fcr === null ? "—" : s.per_unit.fcr.toFixed(2)} hint={s.kg.feed === null ? undefined : `${s.kg.feed.toLocaleString()} kg feed`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit and loss</CardTitle>
            <CardDescription>Stock is costed when used, at its average purchase price</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-normal" />
                  <th className="pb-2 text-right font-normal">Amount</th>
                  <th className="w-20 pb-2 text-right font-normal">Of revenue</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Bird sales" amount={s.revenue.gross} />
                {s.revenue.discounts > 0 && <Row label="Discounts given" amount={-s.revenue.discounts} muted />}
                <Row label="Revenue" amount={s.revenue.net} share={s.revenue.net > 0 ? "100%" : ""} strong rule />

                {sections.map(({ sec, lines }) => {
                  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
                  const single = lines.length === 1 && lines[0]!.label === SECTION_LABEL[sec];
                  return (
                    <Fragment key={sec}>
                      <Row label={SECTION_LABEL[sec]} amount={-subtotal} share={ofRevenue(subtotal)} />
                      {!single && lines.map((l) => <Row key={l.label} label={l.label} amount={-l.amount} indent muted />)}
                    </Fragment>
                  );
                })}
                <Row label="Total costs" amount={-s.costs} share={ofRevenue(s.costs)} strong rule />
                <Row label="Contribution" hint="what the batch earned before farm-wide costs" amount={s.contribution} share={ofRevenue(s.contribution)} strong />

                <Row label="Share of farm-wide costs" hint="split by bird-days" amount={-s.shared_costs.total} share={ofRevenue(s.shared_costs.total)} />
                {s.shared_costs.by_category.map((c) => (
                  <Row key={c.label} label={c.label} amount={-c.amount} indent muted />
                ))}
                <tr className="border-t-2">
                  <td className="pt-3 text-base font-semibold">{running ? "Net profit so far" : "Net profit"}</td>
                  <td className={cn("pt-3 text-right text-base font-semibold", s.net_profit < 0 && "text-critical")}>{formatMoney(s.net_profit)}</td>
                  <td className="pt-3 text-right text-xs text-muted-foreground">{s.margin === null ? "" : pct(s.margin)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where the cost went</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {[...sections.map(({ sec, lines }) => ({ label: SECTION_LABEL[sec], amount: lines.reduce((a, l) => a + l.amount, 0) })), { label: "Farm-wide share", amount: s.shared_costs.total }]
                .filter((x) => x.amount > 0)
                .sort((a, b) => b.amount - a.amount)
                .map((x) => {
                  const of = totalCost(s) > 0 ? x.amount / totalCost(s) : 0;
                  return (
                    <div key={x.label} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span>{x.label}</span>
                        <span className="tabular-nums">
                          {formatMoney(x.amount)} <span className="text-xs text-muted-foreground">{(of * 100).toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${of * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Birds and money</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
                <Fact label="Placed" value={s.birds.placed.toLocaleString()} />
                <Fact label="Died" value={`${s.birds.died.toLocaleString()} (${pct(s.birds.mortality_rate)})`} />
                <Fact label="Sold" value={s.birds.sold.toLocaleString()} />
                <Fact label="Still on the farm" value={s.birds.live.toLocaleString()} />
                <Fact label="Kg sold" value={s.kg.sold.toLocaleString()} />
                <Fact label="Cost per bird placed" value={maybe(s.per_unit.cost_per_bird)} />
                <Fact label="Received from buyers" value={formatMoney(s.money.received)} />
                <Fact label="Buyers still owe" value={formatMoney(s.money.due)} warn={s.money.due > 0} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  hint,
  amount,
  share,
  strong,
  muted,
  indent,
  rule,
}: {
  label: string;
  hint?: string;
  amount: number;
  share?: string;
  strong?: boolean;
  muted?: boolean;
  indent?: boolean;
  rule?: boolean;
}) {
  return (
    <tr className={cn(rule && "border-b", muted && "text-muted-foreground")}>
      <td className={cn("py-1.5", indent && "pl-5 text-xs", strong && "font-semibold")}>
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span>}
      </td>
      <td className={cn("py-1.5 text-right", strong && "font-semibold", indent && "text-xs", amount < 0 && !muted && !strong && "text-foreground")}>
        {amount < 0 ? `−${formatMoney(-amount)}` : formatMoney(amount)}
      </td>
      <td className="py-1.5 text-right text-xs text-muted-foreground">{share ?? ""}</td>
    </tr>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", warn && "text-warning")}>{value}</dd>
    </div>
  );
}

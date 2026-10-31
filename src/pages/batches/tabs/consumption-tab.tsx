import { useState } from "react";
import { Home, Package } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { SectionHeader } from "@/components/shared/section-header";
import { TruncatedText } from "@/components/shared/truncated-text";
import { useGetData } from "@/lib/api";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  chartAxisProps,
  chartGridProps,
  chartTooltipContentStyle,
  OTHER_COLOR,
  SINGLE_SERIES_STROKE,
} from "@/pages/analytics/chart-theme";

type Amounts = { used: number; in_use: number; in_use_units: number; allocated: number; cost: number | null };
type HouseRow = Amounts & { house_id: string; house_name: string };
type ItemRow = Amounts & {
  item_id: string;
  item_name: string;
  category: string;
  unit: string;
  non_depleting: boolean;
  unit_cost: number | null;
  houses: HouseRow[];
};
type DayRow = { day: number; feed_cost: number; health_cost: number; other_cost: number; feed_kg: number; birds: number };
/** GET /analytics/batches/:id/stock */
type BatchStock = {
  items: ItemRow[];
  stays: { house_id: string; house_name: string; from: string; to: string }[];
  total_cost: number;
  cost_by_category: { feed: number; health: number; other: number };
  uncosted_items: string[];
  daily: DayRow[];
};

const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
const muted = <span className="text-muted-foreground">—</span>;

function costCell(r: { cost: number | null }, nonDepleting: boolean) {
  if (nonDepleting) return <span className="text-muted-foreground">Depreciation</span>;
  return r.cost === null ? <span className="text-muted-foreground">No price</span> : formatMoney(r.cost);
}

function inUseCell(r: Amounts, unit: string) {
  if (r.in_use_units === 0) return muted;
  return (
    <span>
      {qty(r.in_use)} {humanizeEnum(unit)}
      <span className="ml-1 text-xs text-muted-foreground">
        ({r.in_use_units} open)
      </span>
    </span>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty: string | null; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
            {empty}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            {children}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

type Slice = { name: string; cost: number; amount: string; color: string };

/** Medicine cost by medicine: the top four get a colour each, the rest fold into Other (the palette has four). */
function medicineSlices(items: ItemRow[]): Slice[] {
  const meds = items
    .filter((i) => i.category === "MEDICINE" && (i.cost ?? 0) > 0)
    .sort((a, b) => b.cost! - a.cost!);
  const top: Slice[] = meds.slice(0, 4).map((i, n) => ({
    name: i.item_name,
    cost: i.cost!,
    amount: `${qty(i.used + i.in_use)} ${humanizeEnum(i.unit)}`,
    color: CATEGORICAL_COLORS[n]!,
  }));
  const rest = meds.slice(4);
  if (rest.length)
    top.push({
      name: `Other (${rest.length})`,
      cost: Number(rest.reduce((s, i) => s + i.cost!, 0).toFixed(2)),
      amount: rest.map((i) => i.item_name).join(", "),
      color: OTHER_COLOR,
    });
  return top;
}

function MedicineDonut({ items }: { items: ItemRow[] }) {
  const slices = medicineSlices(items);
  const total = slices.reduce((s, x) => s + x.cost, 0);
  const pct = (v: number) => `${((v / total) * 100).toFixed(0)}%`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Medicine cost by medicine</CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
            No medicine used yet.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative size-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="cost"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={1}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  >
                    {slices.map((x) => (
                      <Cell key={x.name} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    formatter={(v: TooltipValueType | undefined, _name, entry) => {
                      const x = entry.payload as Slice;
                      return [`${formatMoney(Number(v ?? 0))} · ${pct(Number(v))} · ${x.amount}`, x.name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-semibold tabular-nums">{formatMoney(Number(total.toFixed(2)))}</span>
                <span className="text-xs text-muted-foreground">medicine</span>
              </div>
            </div>
            <ul className="flex w-full min-w-0 flex-col gap-2">
              {slices.map((x) => (
                <li key={x.name} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.color }} />
                  <TruncatedText text={x.name} className="max-w-none min-w-0 flex-1" />
                  <span className="shrink-0 tabular-nums">{formatMoney(x.cost)}</span>
                  <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{pct(x.cost)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Per-house breakdown of one item, plus when the batch was in each house -- allocated only counts that window. */
function ItemHousesSheet({ item, stays, onClose }: { item: ItemRow | null; stays: BatchStock["stays"]; onClose: () => void }) {
  const columns: Column<HouseRow>[] = [
    { key: "house", header: "House", render: (h) => h.house_name, sortValue: (h) => h.house_name },
    { key: "used", header: "Used", render: (h) => qty(h.used), numeric: true, sortValue: (h) => h.used },
    { key: "in_use", header: "In use", render: (h) => inUseCell(h, item?.unit ?? ""), numeric: true, sortValue: (h) => h.in_use },
    { key: "allocated", header: "Allocated", render: (h) => (h.allocated ? qty(h.allocated) : muted), numeric: true, sortValue: (h) => h.allocated },
    { key: "cost", header: "Cost", render: (h) => costCell(h, !!item?.non_depleting), numeric: true, sortValue: (h) => h.cost ?? -1 },
  ];
  const stayOf = (houseId: string) => stays.find((s) => s.house_id === houseId);

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      {item && (
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{item.item_name}</SheetTitle>
            <SheetDescription>
              {humanizeEnum(item.category)} · amounts in {humanizeEnum(item.unit)}
              {item.unit_cost !== null && !item.non_depleting && ` · avg ${formatMoney(item.unit_cost)} per ${humanizeEnum(item.unit)}`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
            <DataTable
              columns={columns}
              rows={item.houses}
              rowKey={(h) => h.house_id}
              empty={{ icon: Home, title: "Not used in any house" }}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Batch in these houses</p>
              {item.houses.map((h) => {
                const s = stayOf(h.house_id);
                return (
                  <div key={h.house_id} className="flex justify-between gap-3 text-sm">
                    <span>{h.house_name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {s ? `${formatDate(s.from)} – ${formatDate(s.to)}` : "—"}
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Allocated counts only stock moved into a house during these dates. In use is what's left in opened
                bottles this batch drew from last.
              </p>
            </div>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

export function ConsumptionTab({ batch }: { batch: Batch }) {
  const [selected, setSelected] = useState<ItemRow | null>(null);
  const { data, isLoading, isError } = useGetData<BatchStock>(`/analytics/batches/${batch.id}/stock`, [
    "analytics",
    "batch-stock",
    batch.id,
  ]);

  if (isError) return <p className="text-sm text-muted-foreground">Couldn't load stock for this batch.</p>;

  const items = data?.items ?? [];
  const daily = data?.daily ?? [];
  const feedKg = daily.reduce((s, d) => s + d.feed_kg, 0);
  const placed = batch.initial_chick_count;
  const openValue = items.reduce(
    (s, i) => s + (i.cost !== null && i.unit_cost !== null && !i.non_depleting ? i.in_use * i.unit_cost : 0),
    0,
  );
  const feedPerBird = daily
    .filter((d) => d.birds > 0 && d.feed_kg > 0)
    .map((d) => ({ day: d.day, grams: Math.round((d.feed_kg * 1000) / d.birds) }));
  const houseCost = new Map<string, { house: string; cost: number }>();
  for (const i of items)
    for (const h of i.houses) {
      const row = houseCost.get(h.house_id) ?? { house: h.house_name, cost: 0 };
      row.cost += h.cost ?? 0;
      houseCost.set(h.house_id, row);
    }
  const byHouse = [...houseCost.values()].map((r) => ({ ...r, cost: Number(r.cost.toFixed(2)) })).sort((a, b) => b.cost - a.cost);

  const columns: Column<ItemRow>[] = [
    {
      key: "item",
      header: "Item",
      render: (i) => (
        <div>
          <TruncatedText text={i.item_name} className="max-w-56 font-medium" />
          <p className="text-xs text-muted-foreground">{humanizeEnum(i.category)}</p>
        </div>
      ),
      sortValue: (i) => i.item_name,
      exportValue: (i) => i.item_name,
    },
    {
      key: "used",
      header: "Used",
      render: (i) => `${qty(i.used)} ${humanizeEnum(i.unit)}`,
      numeric: true,
      sortValue: (i) => i.used,
      exportValue: (i) => i.used,
    },
    { key: "in_use", header: "In use", render: (i) => inUseCell(i, i.unit), numeric: true, sortValue: (i) => i.in_use, exportValue: (i) => i.in_use },
    {
      key: "allocated",
      header: "Allocated",
      render: (i) => (i.allocated ? `${qty(i.allocated)} ${humanizeEnum(i.unit)}` : muted),
      numeric: true,
      sortValue: (i) => i.allocated,
      exportValue: (i) => i.allocated,
    },
    {
      key: "cost",
      header: "Cost",
      render: (i) => costCell(i, i.non_depleting),
      numeric: true,
      sortValue: (i) => i.cost ?? -1,
      exportValue: (i) => i.cost,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Consumption"
        description="Stock this batch used, has open, and was allocated, across every house it stayed in"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Stock cost" value={data ? formatMoney(data.total_cost) : ""} isLoading={isLoading} hint="used + in use" />
        <KPICard
          label="Cost per bird"
          value={data && placed > 0 ? formatMoney(Number((data.total_cost / placed).toFixed(2))) : "—"}
          isLoading={isLoading}
          hint={`of ${placed.toLocaleString()} placed`}
        />
        <KPICard
          label="Feed used"
          value={`${qty(Math.round(feedKg))} kg`}
          isLoading={isLoading}
          hint={placed > 0 ? `${((feedKg * 1000) / placed).toFixed(0)} g per bird placed` : undefined}
        />
        <KPICard
          label="Open stock"
          value={formatMoney(Number(openValue.toFixed(2)))}
          isLoading={isLoading}
          hint="left in opened bottles, counted in cost"
        />
      </div>

      <div className="flex flex-col gap-2">
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(i) => i.item_id}
          isLoading={isLoading}
          onRowClick={setSelected}
          exportable
          exportName={`${batch.batch_code}-consumption`}
          empty={{ icon: Package, title: "No stock used by this batch yet" }}
          footer={
            data?.uncosted_items.length
              ? `No purchase price for ${data.uncosted_items.join(", ")} -- left out of the total.`
              : "Click an item to see it house by house."
          }
        />
        {data && (
          <div className="flex items-baseline justify-between rounded-lg border border-border px-4 py-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-semibold tabular-nums">{formatMoney(data.total_cost)}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Daily stock cost by day of the batch"
            empty={daily.some((d) => d.feed_cost + d.health_cost + d.other_cost > 0) ? null : "No costed stock used yet."}
          >
            <BarChart data={daily}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="day" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                labelFormatter={(d) => `Day ${d}`}
                formatter={(v: TooltipValueType | undefined, name) => [formatMoney(Number(v ?? 0)), name]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="feed_cost" name="Feed" stackId="c" fill={CATEGORICAL_COLORS[0]} />
              <Bar dataKey="health_cost" name="Medicine & vaccines" stackId="c" fill={CATEGORICAL_COLORS[1]} />
              <Bar dataKey="other_cost" name="Other" stackId="c" fill={CATEGORICAL_COLORS[2]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Feed per live bird (g / day)" empty={feedPerBird.length ? null : "No feed with a weight unit used yet."}>
            <LineChart data={feedPerBird}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="day" {...chartAxisProps} />
              <YAxis {...chartAxisProps} allowDecimals={false} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                labelFormatter={(d) => `Day ${d}`}
                formatter={(v: TooltipValueType | undefined) => [`${v} g`, "Feed per bird"]}
              />
              <Line type="monotone" dataKey="grams" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Stock cost by house" empty={byHouse.some((h) => h.cost > 0) ? null : "No costed stock used yet."}>
            <BarChart data={byHouse} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="house" width={110} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => [formatMoney(Number(v ?? 0)), "Cost"]}
              />
              <Bar dataKey="cost" fill={SINGLE_SERIES_STROKE} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Where the money went" empty={data && data.total_cost > 0 ? null : "No costed stock used yet."}>
            <BarChart
              data={[
                { name: "Feed", cost: data?.cost_by_category.feed ?? 0 },
                { name: "Medicine & vaccines", cost: data?.cost_by_category.health ?? 0 },
                { name: "Other", cost: data?.cost_by_category.other ?? 0 },
              ]}
              layout="vertical"
              margin={{ left: 8 }}
            >
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" {...chartAxisProps} />
              <YAxis type="category" dataKey="name" width={130} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => [
                  `${formatMoney(Number(v ?? 0))} (${data && data.total_cost > 0 ? ((Number(v) / data.total_cost) * 100).toFixed(0) : 0}%)`,
                  "Cost",
                ]}
              />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={18}>
                {CATEGORICAL_COLORS.slice(0, 3).map((c) => (
                  <Cell key={c} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>

          <MedicineDonut items={items} />
        </div>
      )}

      <ItemHousesSheet item={selected} stays={data?.stays ?? []} onClose={() => setSelected(null)} />
    </div>
  );
}

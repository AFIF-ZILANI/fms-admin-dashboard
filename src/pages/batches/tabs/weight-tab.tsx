import { useState, useMemo } from "react";
import { Plus, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Batch, WeightRecord } from "@/pages/batches/types";
import { WeightFormDialog } from "@/pages/batches/tabs/weight-form-dialog";
import { cycleDay } from "@/pages/batches/cycle-day";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";

export function WeightTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);
  const [chart, setChart] = useState<"curve" | "gain">("curve");

  const { data, isLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batch.id}&limit=100`,
    ["weight-records", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const growthSeries = useMemo(() => {
    const byDate = new Map<string, number[]>();
    for (const w of data?.results ?? []) {
      const key = w.date.slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push(parseFloat(w.average_wt_grams));
      byDate.set(key, list);
    }
    return Array.from(byDate.entries())
      .map(([date, weights]) => ({ date, weight: weights.reduce((sum, w) => sum + w, 0) / weights.length }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Gain since the sample before, by batch day; the first sample counts from the chicks' start weight on day 0.
  // Samples aren't evenly spaced, so each bar also carries how many days it covers.
  const gainSeries = useMemo(() => {
    const points = [
      { day: 0, weight: batch.init_chicks_avg_wt },
      ...growthSeries.map(({ date, weight }) => ({ day: cycleDay(batch.starting_date, new Date(date)), weight })),
    ];
    return points.slice(1).map(({ day, weight }, i) => {
      const prev = points[i]!;
      const gain = weight - prev.weight;
      const days = Math.max(day - prev.day, 1);
      return { day: `Day ${day}`, gain: Math.round(gain), days, perDay: gain / days };
    });
  }, [growthSeries, batch.starting_date, batch.init_chicks_avg_wt]);

  const latest = growthSeries.at(-1);
  const previous = growthSeries.at(-2);
  const gain = latest && previous ? latest.weight - previous.weight : undefined;

  const columns: Column<WeightRecord>[] = [
    { key: "date", header: "Date", render: (w) => formatDate(w.date), sortValue: (w) => w.date },
    { key: "house", header: "House", render: (w) => houseName(w.house_id), sortValue: (w) => houseName(w.house_id) },
    {
      key: "avg",
      header: "Avg weight (g)",
      render: (w) => formatMoney(w.average_wt_grams),
      numeric: true,
      sortValue: (w) => parseFloat(w.average_wt_grams),
    },
    { key: "sample", header: "Sample size", render: (w) => w.sample_size, numeric: true, sortValue: (w) => w.sample_size },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Weight samples"
          description={
            latest
              ? `Latest average ${formatMoney(latest.weight)} g${gain !== undefined ? ` · ${gain >= 0 ? "+" : ""}${formatMoney(gain)} g since the previous sample` : ""}`
              : "Sample birds regularly to track the growth curve."
          }
        >
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus />
            Log weight
          </Button>
        </SectionHeader>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {chart === "curve" ? "Growth curve" : "Weight gain between samples"}
            </CardTitle>
            <Tabs value={chart} onValueChange={(v) => setChart(v as typeof chart)}>
              <TabsList>
                <TabsTrigger value="curve">Growth curve</TabsTrigger>
                <TabsTrigger value="gain">Weight gain</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
            {!isLoading && growthSeries.length === 0 && (
              <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
                No weight samples logged yet — the curve appears after the first entry.
              </div>
            )}
            {!isLoading && growthSeries.length > 0 && chart === "curve" && (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart data={growthSeries}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    formatter={(v: TooltipValueType | undefined) => [`${v} g`, "Avg weight"]}
                  />
                  <Line type="monotone" dataKey="weight" name="Avg weight (g)" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {!isLoading && growthSeries.length > 0 && chart === "gain" && (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={gainSeries} margin={{ top: 20 }}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="day" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    formatter={(v: TooltipValueType | undefined, _name, item) => {
                      const { days, perDay } = item.payload as (typeof gainSeries)[number];
                      return [`${Number(v) >= 0 ? "+" : ""}${v} g over ${days} day${days === 1 ? "" : "s"} (${perDay.toFixed(1)} g/day)`, "Gain"];
                    }}
                  />
                  <Bar dataKey="gain" name="Gain (g)" fill={SINGLE_SERIES_STROKE} radius={[2, 2, 0, 0]}>
                    <LabelList
                      dataKey="gain"
                      position="top"
                      className="fill-muted-foreground text-xs tabular-nums"
                      formatter={(v: unknown) => `${Number(v) >= 0 ? "+" : ""}${String(v)}g`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        empty={{
          icon: Scale,
          title: "No weight samples logged for this batch",
          description: "Log a sample to start the growth curve.",
          action: { label: "Log weight", onClick: () => setFormOpen(true) },
        }}
        footer={data && data.total > data.results.length ? `Showing the latest ${data.results.length} of ${data.total} samples.` : undefined}
      />

      <WeightFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

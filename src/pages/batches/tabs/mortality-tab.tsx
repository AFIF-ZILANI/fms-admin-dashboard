import { useMemo, useState } from "react";
import { Plus, Skull } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import type { Batch, MortalityLog } from "@/pages/batches/types";
import { MortalityFormDialog } from "@/pages/batches/tabs/mortality-form-dialog";
import { cycleDay } from "@/pages/batches/cycle-day";
import { farmToday } from "@/lib/farm-day";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";

/** "6/9/2026, 14:30" in the farm's (browser's) zone. Mortality is an instant, unlike the UTC-midnight
 * dates formatDate handles. Web logs made before the time field existed show 06:00 (UTC midnight in BD). */
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short", hourCycle: "h23" });

export function MortalityTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);
  const [chart, setChart] = useState<"cumulative" | "age">("cumulative");

  const { data, isLoading } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?batch_id=${batch.id}&limit=100`,
    ["mortality-logs", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const logs = data?.results ?? [];
  const totalDied = logs.reduce((sum, m) => sum + m.count_died, 0);
  const rate = batch.initial_chick_count > 0 ? (totalDied / batch.initial_chick_count) * 100 : 0;

  const columns: Column<MortalityLog>[] = [
    { key: "date", header: "Date & time", render: (m) => formatDateTime(m.date), sortValue: (m) => m.date },
    { key: "age", header: "Age", render: (m) => `Day ${cycleDay(batch.starting_date, new Date(m.date))}`, numeric: true, sortValue: (m) => m.date },
    { key: "house", header: "House", render: (m) => houseName(m.house_id), sortValue: (m) => houseName(m.house_id) },
    { key: "count", header: "Died", render: (m) => m.count_died.toLocaleString(), numeric: true, sortValue: (m) => m.count_died },
    { key: "cause", header: "Cause", render: (m) => m.cause_note ?? <span className="text-muted-foreground">—</span> },
  ];

  const cumulativeSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const log of data?.results ?? []) {
      const key = farmToday(new Date(log.date)); // the farm date it counts toward, not the UTC one
      byDate.set(key, (byDate.get(key) ?? 0) + log.count_died);
    }
    const series: { date: string; cumulative: number }[] = [];
    let running = 0;
    for (const date of Array.from(byDate.keys()).sort()) {
      running += byDate.get(date)!;
      series.push({ date, cumulative: running });
    }
    return series;
  }, [data]);

  // Every day from 1 to the last logged day, zeros included, so quiet days read as quiet rather than vanish.
  const byAgeSeries = useMemo(() => {
    const byDay = new Map<number, number>();
    for (const log of data?.results ?? []) {
      const day = cycleDay(batch.starting_date, new Date(log.date));
      byDay.set(day, (byDay.get(day) ?? 0) + log.count_died);
    }
    const last = Math.max(0, ...byDay.keys());
    return Array.from({ length: last }, (_, i) => ({ day: i + 1, died: byDay.get(i + 1) ?? 0 }));
  }, [data, batch.starting_date]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Mortality"
          description={
            isLoading
              ? "Loading…"
              : `${totalDied.toLocaleString()} birds lost so far · ${rate.toFixed(1)}% of the ${batch.initial_chick_count.toLocaleString()} placed`
          }
        >
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus />
            Log mortality
          </Button>
        </SectionHeader>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {chart === "cumulative" ? "Cumulative deaths over time" : "Deaths by age (day of batch)"}
            </CardTitle>
            <Tabs value={chart} onValueChange={(v) => setChart(v as typeof chart)}>
              <TabsList>
                <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
                <TabsTrigger value="age">By age</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
            {!isLoading && cumulativeSeries.length === 0 && (
              <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
                No mortality logged yet — the curve appears after the first entry.
              </div>
            )}
            {!isLoading && cumulativeSeries.length > 0 && chart === "cumulative" && (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart data={cumulativeSeries}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="date" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    formatter={(v: TooltipValueType | undefined) => [String(v), "Cumulative died"]}
                  />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative died" stroke={SINGLE_SERIES_STROKE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {!isLoading && cumulativeSeries.length > 0 && chart === "age" && (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={byAgeSeries}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="day" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    labelFormatter={(day) => `Day ${day}`}
                    formatter={(v: TooltipValueType | undefined) => [String(v), "Died"]}
                  />
                  <Bar dataKey="died" name="Died" fill={SINGLE_SERIES_STROKE} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={logs.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
        rowKey={(m) => m.id}
        isLoading={isLoading}
        empty={{
          icon: Skull,
          title: "No mortality recorded for this batch",
          description: "Good news — log an entry here when birds are lost.",
          action: { label: "Log mortality", onClick: () => setFormOpen(true) },
        }}
        footer={
          data && data.total > data.results.length
            ? `Showing the latest ${data.results.length} of ${data.total} logs — the chart may not reflect full cumulative history.`
            : undefined
        }
      />

      <MortalityFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

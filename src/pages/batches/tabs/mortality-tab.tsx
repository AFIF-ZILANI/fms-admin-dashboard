import { useMemo, useState } from "react";
import { Plus, Skull } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Batch, MortalityLog } from "@/pages/batches/types";
import { MortalityFormDialog } from "@/pages/batches/tabs/mortality-form-dialog";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";

export function MortalityTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?batch_id=${batch.id}&limit=100`,
    ["mortality-logs", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const logs = data?.results ?? [];
  const totalDied = logs.reduce((sum, m) => sum + m.count_died, 0);
  const rate = batch.initial_chick_count > 0 ? (totalDied / batch.initial_chick_count) * 100 : 0;

  const columns: Column<MortalityLog>[] = [
    { key: "date", header: "Date", render: (m) => formatDate(m.date), sortValue: (m) => m.date },
    { key: "house", header: "House", render: (m) => houseName(m.house_id), sortValue: (m) => houseName(m.house_id) },
    { key: "count", header: "Died", render: (m) => m.count_died.toLocaleString(), numeric: true, sortValue: (m) => m.count_died },
    { key: "cause", header: "Cause", render: (m) => m.cause_note ?? <span className="text-muted-foreground">—</span> },
  ];

  const cumulativeSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const log of data?.results ?? []) {
      const key = log.date.slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + log.count_died);
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    let running = 0;
    return sortedDates.map((date) => {
      running += byDate.get(date)!;
      return { date, cumulative: running };
    });
  }, [data]);

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
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Cumulative deaths over time</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
            {!isLoading && cumulativeSeries.length === 0 && (
              <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
                No mortality logged yet — the curve appears after the first entry.
              </div>
            )}
            {!isLoading && cumulativeSeries.length > 0 && (
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

import { useMemo, useState } from "react";
import { Plus, Skull } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
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

  const columns: Column<MortalityLog>[] = [
    { key: "date", header: "Date", render: (m) => new Date(m.date).toLocaleDateString() },
    { key: "house", header: "House", render: (m) => houseName(m.house_id) },
    { key: "count", header: "Died", render: (m) => m.count_died, numeric: true },
    { key: "cause", header: "Cause", render: (m) => m.cause_note ?? "—" },
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cumulative mortality</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
          {!isLoading && cumulativeSeries.length === 0 && (
            <p className="text-sm text-muted-foreground">No mortality logged yet.</p>
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

      {data && data.total > data.results.length && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {data.results.length} of {data.total} mortality logs — the chart may not reflect full
          cumulative history.
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Log mortality
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(m) => m.id}
        isLoading={isLoading}
        empty={{ icon: Skull, title: "No mortality recorded for this batch" }}
      />

      <MortalityFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

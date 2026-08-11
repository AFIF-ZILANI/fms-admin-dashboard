import { useState, useMemo } from "react";
import { Plus, Scale } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch, WeightRecord } from "@/pages/batches/types";
import { WeightFormDialog } from "@/pages/batches/tabs/weight-form-dialog";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";

export function WeightTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batch.id}&limit=100`,
    ["weight-records", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const growthSeries = useMemo(
    () =>
      (data?.results ?? [])
        .map((w) => ({ date: w.date.slice(0, 10), weight: parseFloat(w.average_wt_grams) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );

  const columns: Column<WeightRecord>[] = [
    { key: "date", header: "Date", render: (w) => new Date(w.date).toLocaleDateString() },
    { key: "house", header: "House", render: (w) => houseName(w.house_id) },
    { key: "avg", header: "Avg weight (g)", render: (w) => formatMoney(w.average_wt_grams), numeric: true },
    { key: "sample", header: "Sample size", render: (w) => w.sample_size, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Growth curve</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
          {!isLoading && growthSeries.length === 0 && (
            <p className="text-sm text-muted-foreground">No weight samples logged yet.</p>
          )}
          {!isLoading && growthSeries.length > 0 && (
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Log weight
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        empty={{ icon: Scale, title: "No weight samples logged for this batch" }}
      />

      <WeightFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

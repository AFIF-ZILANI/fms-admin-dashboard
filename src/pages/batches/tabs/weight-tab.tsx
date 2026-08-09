import { useState } from "react";
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch, WeightRecord } from "@/pages/batches/types";
import { WeightFormDialog } from "@/pages/batches/tabs/weight-form-dialog";

export function WeightTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batch.id}&limit=100`,
    ["weight-records", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const columns: Column<WeightRecord>[] = [
    { key: "date", header: "Date", render: (w) => new Date(w.date).toLocaleDateString() },
    { key: "house", header: "House", render: (w) => houseName(w.house_id) },
    { key: "avg", header: "Avg weight (g)", render: (w) => formatMoney(w.average_wt_grams), numeric: true },
    { key: "sample", header: "Sample size", render: (w) => w.sample_size, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
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

import { useState } from "react";
import { Plus, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import type { Batch, MortalityLog } from "@/pages/batches/types";
import { MortalityFormDialog } from "@/pages/batches/tabs/mortality-form-dialog";

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

  return (
    <div className="flex flex-col gap-4">
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

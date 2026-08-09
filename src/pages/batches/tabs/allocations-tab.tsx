import { useState } from "react";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Batch, BatchHouseAllocation } from "@/pages/batches/types";
import { AllocationFormDialog } from "@/pages/batches/tabs/allocation-form-dialog";

export function AllocationsTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<BatchHouseAllocation>>(
    `/batch-house-allocations?batch_id=${batch.id}&limit=100`,
    ["batch-house-allocations", batch.id]
  );

  // Every house this batch has ever touched appears in houseBalances (docs/PRD.md §6.2 notes) — enough for id -> name lookup here.
  const houseName = (id: string | null) => (id ? (batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id) : "—");

  const columns: Column<BatchHouseAllocation>[] = [
    { key: "date", header: "Date", render: (a) => new Date(a.occurred_at).toLocaleDateString() },
    { key: "from", header: "From", render: (a) => houseName(a.from_house_id) },
    { key: "to", header: "To", render: (a) => houseName(a.to_house_id) },
    { key: "quantity", header: "Birds", render: (a) => a.quantity.toLocaleString(), numeric: true },
    { key: "reason", header: "Reason", render: (a) => humanizeEnum(a.reason) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Record allocation
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        empty={{ icon: ArrowLeftRight, title: "No allocations beyond the initial placement" }}
      />

      <AllocationFormDialog open={formOpen} onOpenChange={setFormOpen} batchId={batch.id} />
    </div>
  );
}

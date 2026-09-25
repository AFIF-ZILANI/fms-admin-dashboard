import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, humanizeEnum } from "@/lib/utils";
import type { Batch, BatchHouseAllocation } from "@/pages/batches/types";
import { AllocationFormDialog } from "@/pages/batches/tabs/allocation-form-dialog";

export function AllocationsTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<BatchHouseAllocation>>(
    `/batch-house-allocations?batch_id=${batch.id}&limit=100`,
    ["batch-house-allocations", batch.id]
  );

  // Every house this batch has ever touched appears in houseBalances (docs/PRD.md §6.2 notes) — enough for id -> name lookup here.
  const houseName = (id: string | null) => (id ? (batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id) : "Outside");

  const columns: Column<BatchHouseAllocation>[] = [
    {
      key: "date",
      header: "Date",
      render: (a) => formatDate(a.occurred_at),
      sortValue: (a) => a.occurred_at,
    },
    {
      key: "movement",
      header: "Movement",
      render: (a) => (
        <span className="inline-flex items-center gap-2">
          <span className={a.from_house_id ? undefined : "text-muted-foreground"}>{houseName(a.from_house_id)}</span>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
          <span className={a.to_house_id ? undefined : "text-muted-foreground"}>{houseName(a.to_house_id)}</span>
        </span>
      ),
    },
    { key: "quantity", header: "Birds", render: (a) => a.quantity.toLocaleString(), numeric: true, sortValue: (a) => a.quantity },
    { key: "reason", header: "Reason", render: (a) => humanizeEnum(a.reason), sortValue: (a) => a.reason },
  ];

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="House allocations" description="Every placement, transfer, and adjustment for this batch.">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Record allocation
        </Button>
      </SectionHeader>

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).slice().sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        empty={{
          icon: ArrowLeftRight,
          title: "No allocations beyond the initial placement",
          description: "Move birds between houses to see the history here.",
          action: { label: "Record allocation", onClick: () => setFormOpen(true) },
        }}
        footer={data && data.total > data.results.length ? `Showing the latest ${data.results.length} of ${data.total} allocations.` : undefined}
      />

      <AllocationFormDialog open={formOpen} onOpenChange={setFormOpen} batchId={batch.id} />
    </div>
  );
}

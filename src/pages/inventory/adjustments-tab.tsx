import { useState } from "react";
import { ClipboardEdit, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InventoryAdjustment } from "@/pages/inventory/types";
import { AdjustmentFormDialog } from "@/pages/inventory/adjustment-form-dialog";

export function AdjustmentsTab() {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<InventoryAdjustment>>("/inventory-adjustments?limit=100", [
    "inventory-adjustments",
  ]);
  const adjustments = data?.results ?? [];
  const totalAdjustments = data?.total ?? adjustments.length;
  const increaseCount = adjustments.filter((a) => parseFloat(a.adjustment_quantity) > 0).length;
  const decreaseCount = adjustments.filter((a) => parseFloat(a.adjustment_quantity) < 0).length;

  const columns: Column<InventoryAdjustment>[] = [
    {
      key: "date",
      header: "Date",
      render: (a) => new Date(a.created_at).toLocaleDateString(),
      sortValue: (a) => new Date(a.created_at).getTime(),
    },
    { key: "item", header: "Item", render: (a) => a.item.name, sortValue: (a) => a.item.name },
    {
      key: "change",
      header: "Before → after",
      render: (a) => `${a.quantity_before} → ${a.quantity_after}`,
    },
    {
      key: "delta",
      header: "Delta",
      render: (a) => {
        const delta = parseFloat(a.adjustment_quantity);
        return (
          <span className={cn("font-medium tabular-nums", delta > 0 ? "text-success" : "text-destructive")}>
            {delta > 0 ? "+" : ""}
            {a.adjustment_quantity}
          </span>
        );
      },
      numeric: true,
    },
    { key: "reason", header: "Reason", render: (a) => a.reason },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total adjustments" value={totalAdjustments} icon={ClipboardEdit} isLoading={isLoading} />
        <KPICard label="Increases" value={increaseCount} icon={TrendingUp} isLoading={isLoading} />
        <KPICard label="Decreases" value={decreaseCount} icon={TrendingDown} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          New adjustment
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={adjustments}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        empty={{
          icon: ClipboardEdit,
          title: "No adjustments yet",
          description: "Corrections to stock counts will show up here.",
          action: { label: "New adjustment", onClick: () => setFormOpen(true) },
        }}
      />

      <AdjustmentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

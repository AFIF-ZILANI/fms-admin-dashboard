import { useState } from "react";
import { ClipboardEdit, Package, PackageX, Plus, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { cn, daysAgoMs } from "@/lib/utils";
import type { InventoryAdjustment } from "@/pages/inventory/types";
import { AdjustmentFormDialog } from "@/pages/inventory/adjustment-form-dialog";

export function AdjustmentsTab() {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<InventoryAdjustment>>("/inventory-adjustments?limit=100", [
    "inventory-adjustments",
  ]);
  const adjustments = data?.results ?? [];
  const totalAdjustments = data?.total ?? adjustments.length;
  // ponytail: 30-day figures come from the latest 100 rows; a server summary if a month ever exceeds 100.
  const since = daysAgoMs(30);
  const recent = adjustments.filter((a) => new Date(a.created_at).getTime() >= since);
  const increaseCount = recent.filter((a) => parseFloat(a.adjustment_quantity) > 0).length;
  const decreaseCount = recent.filter((a) => parseFloat(a.adjustment_quantity) < 0).length;
  const lossReasons = ["Damaged", "Expired", "Theft or loss", "Wastage"];
  const lossCount = recent.filter((a) => lossReasons.includes(a.reason)).length;
  const theftCount = recent.filter((a) => a.reason === "Theft or loss").length;
  const adjustedItems = new Set(recent.map((a) => a.item_id)).size;
  const perItem = new Map<string, { name: string; n: number }>();
  for (const a of recent) perItem.set(a.item_id, { name: a.item.name, n: (perItem.get(a.item_id)?.n ?? 0) + 1 });
  const topItem = [...perItem.values()].sort((x, y) => y.n - x.n)[0];

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Adjustments (30 days)" value={recent.length} hint={`${totalAdjustments} all time`} icon={ClipboardEdit} isLoading={isLoading} />
        <KPICard label="Stock added" value={increaseCount} hint="found or corrected up" icon={TrendingUp} isLoading={isLoading} />
        <KPICard label="Stock removed" value={decreaseCount} hint="written down" icon={TrendingDown} isLoading={isLoading} />
        <KPICard label="Damage / expiry / loss" value={lossCount} hint="last 30 days" tone={lossCount > 0 ? "warning" : undefined} icon={PackageX} isLoading={isLoading} />
        <KPICard label="Theft or loss" value={theftCount} hint="last 30 days" tone={theftCount > 0 ? "critical" : undefined} icon={ShieldAlert} isLoading={isLoading} />
        <KPICard label="Items adjusted" value={adjustedItems} hint="distinct, last 30 days" icon={Package} isLoading={isLoading} />
        <KPICard label="Most adjusted" value={topItem?.n ?? 0} hint={topItem?.name ?? "no adjustments"} icon={ClipboardEdit} isLoading={isLoading} />
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

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { LowStockItem } from "@/pages/inventory/types";

export function LowStockTab() {
  const { data, isLoading } = useGetData<LowStockItem[]>("/items/low-stock", ["items", "low-stock"]);
  const items = data ?? [];
  const criticalItems = items.filter((i) => parseFloat(i.current_balance) <= 0);

  const columns: Column<LowStockItem>[] = [
    { key: "name", header: "Item", render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", render: (i) => humanizeEnum(i.category) },
    {
      key: "current_balance",
      header: "Current balance",
      render: (i) => `${i.current_balance} ${humanizeEnum(i.unit)}`,
      numeric: true,
    },
    { key: "reorder_level", header: "Reorder level", render: (i) => i.reorder_level ?? "—", numeric: true },
    {
      key: "preferred_reorder_qty",
      header: "Reorder qty",
      render: (i) => i.preferred_reorder_qty ?? "—",
      numeric: true,
    },
    {
      key: "lead_time",
      header: "Lead time",
      render: (i) => (i.lead_time_days != null ? `${i.lead_time_days}d` : "—"),
      numeric: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Below reorder level" value={items.length} icon={AlertTriangle} isLoading={isLoading} />
        <KPICard label="Critical" value={criticalItems.length} icon={AlertCircle} isLoading={isLoading} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-critical">
          <AlertCircle className="size-4" />
          <h2 className="text-sm font-medium">Critical — out of stock</h2>
        </div>
        <DataTable
          columns={columns}
          rows={criticalItems}
          rowKey={(i) => i.id}
          isLoading={isLoading}
          empty={{
            icon: CheckCircle2,
            title: "Nothing out of stock",
            description: "No tracked item has hit a zero balance.",
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">All items below reorder level</h2>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(i) => i.id}
          isLoading={isLoading}
          empty={{
            icon: CheckCircle2,
            title: "Nothing below reorder level right now",
            description: "Every tracked item has enough stock.",
          }}
        />
      </div>
    </div>
  );
}

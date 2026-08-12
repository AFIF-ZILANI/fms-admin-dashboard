import { CheckCircle2 } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { LowStockItem } from "@/pages/inventory/types";

export function LowStockTab() {
  const { data, isLoading } = useGetData<LowStockItem[]>("/items/low-stock", ["items", "low-stock"]);
  const items = data ?? [];

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
  );
}

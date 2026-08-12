import { ListTree } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import type { Consumption } from "@/pages/inventory/types";

export function ConsumptionLogTab() {
  const { data, isLoading } = useGetData<Paginated<Consumption>>("/consumptions?limit=100", [
    "consumptions",
  ]);

  const columns: Column<Consumption>[] = [
    {
      key: "date",
      header: "Date",
      render: (c) => new Date(c.date).toLocaleDateString(),
      sortValue: (c) => new Date(c.date).getTime(),
    },
    { key: "item", header: "Item", render: (c) => c.item.name, sortValue: (c) => c.item.name },
    { key: "quantity", header: "Quantity", render: (c) => c.quantity, numeric: true },
    { key: "house", header: "House", render: (c) => c.house.name },
    { key: "batch", header: "Batch", render: (c) => c.batch?.batch_code ?? "—" },
    {
      key: "coded_unit",
      header: "Coded unit",
      render: (c) => (c.stock_unit ? <span className="font-mono text-xs">{c.stock_unit.code}</span> : "—"),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data?.results ?? []}
      rowKey={(c) => c.id}
      isLoading={isLoading}
      empty={{
        icon: ListTree,
        title: "No consumption recorded yet",
        description: "Feed, medicine, and equipment draws will show up here regardless of where they were recorded.",
      }}
    />
  );
}

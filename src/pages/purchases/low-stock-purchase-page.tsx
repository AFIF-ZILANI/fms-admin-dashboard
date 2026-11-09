import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { LowStockItem } from "@/pages/inventory/types";
import { useFormatStock } from "@/pages/inventory/use-format-stock";

/** Every item below its reorder level, each one a click away from a purchase prefilled with it. */
export function LowStockPurchasePage() {
  const fmt = useFormatStock();
  usePageTitle("Below reorder level");
  const navigate = useNavigate();
  const { data, isLoading } = useGetData<LowStockItem[]>("/items/low-stock", ["items", "low-stock"]);

  const purchase = (i: LowStockItem) => {
    // The reorder quantity is in the item's base unit, so the line starts on that unit too.
    const params = new URLSearchParams({ item: i.id, unit: i.unit });
    if (i.preferred_reorder_qty) params.set("qty", i.preferred_reorder_qty);
    navigate(`/purchases/new?${params}`);
  };

  const columns: Column<LowStockItem>[] = [
    { key: "name", header: "Item", render: (i) => <span className="font-medium">{i.name}</span>, sortValue: (i) => i.name },
    { key: "category", header: "Category", render: (i) => humanizeEnum(i.category), sortValue: (i) => i.category },
    {
      key: "current_balance",
      header: "Current balance",
      render: (i) => fmt.stock(i.current_balance, i.id, i.unit),
      numeric: true,
      sortValue: (i) => parseFloat(i.current_balance),
    },
    { key: "reorder_level", header: "Reorder level", render: (i) => i.reorder_level ?? "—", numeric: true },
    { key: "preferred_reorder_qty", header: "Reorder qty", render: (i) => i.preferred_reorder_qty ?? "—", numeric: true },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (i) => (
        <Button size="sm" variant="outline" onClick={() => purchase(i)}>
          <ShoppingCart />
          Purchase
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/purchases")}>
        <ArrowLeft />
        Back to purchases
      </Button>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        empty={{
          icon: CheckCircle2,
          title: "Nothing below reorder level right now",
          description: "Every tracked item has enough stock.",
        }}
      />
    </div>
  );
}

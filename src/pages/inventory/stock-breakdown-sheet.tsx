import { Warehouse } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/shared/data-table";
import { humanizeEnum } from "@/lib/utils";
import type { ItemStockByLocation } from "@/pages/inventory/types";

type StockBreakdownSheetProps = {
  /** null = closed. Set to open, carrying which item + which location kind to break down. */
  target: { itemName: string; unit: string; kind: "WAREHOUSE" | "HOUSE" } | null;
  rows: ItemStockByLocation[];
  onOpenChange: (open: boolean) => void;
};

/** Drill-down for a catalog stock column: lists each warehouse (or house) holding the item and
 * how much. `rows` are the already-fetched stock-by-location entries for this one item + kind. */
export function StockBreakdownSheet({ target, rows, onOpenChange }: StockBreakdownSheetProps) {
  const locationLabel = target?.kind === "HOUSE" ? "House" : "Warehouse";

  const columns: Column<ItemStockByLocation>[] = [
    { key: "location", header: locationLabel, render: (r) => r.location_name },
    { key: "balance", header: "Balance", render: (r) => r.balance, numeric: true, sortValue: (r) => Number(r.balance) },
  ];

  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      {target && (
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{target.kind === "HOUSE" ? "Stock in houses" : "Warehouse stock"}</SheetTitle>
            <SheetDescription>
              {target.itemName} · {humanizeEnum(target.unit)}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.location_id}
              empty={{ icon: Warehouse, title: `No stock in any ${locationLabel.toLowerCase()} yet` }}
            />
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

import { Package } from "lucide-react";
import { TruncatedText } from "@/components/shared/truncated-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData } from "@/lib/api";
import type { LocationStockRow } from "@/pages/inventory/types";
import { useFormatStock } from "@/pages/inventory/use-format-stock";

type HouseStockDialogProps = {
  houseId: string;
  houseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HouseStockDialog({ houseId, houseName, open, onOpenChange }: HouseStockDialogProps) {
  const { data: stock, isLoading } = useGetData<LocationStockRow[]>(
    `/houses/${houseId}/stock`,
    ["houses", houseId, "stock"],
    { enabled: open }
  );

  const fmt = useFormatStock();
  const columns: Column<LocationStockRow>[] = [
    { key: "item", header: "Item", render: (row) => <TruncatedText text={row.item_name} className="max-w-48" /> },
    { key: "balance", header: "On hand", render: (row) => fmt.stock(row.balance, row.item_id, row.unit), numeric: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock at {houseName}</DialogTitle>
          <DialogDescription>Items currently on hand here, transferred but not yet used.</DialogDescription>
        </DialogHeader>
        <DataTable
          columns={columns}
          rows={stock ?? []}
          rowKey={(row) => row.item_id}
          isLoading={isLoading}
          empty={{ icon: Package, title: "Nothing on hand here yet" }}
        />
      </DialogContent>
    </Dialog>
  );
}

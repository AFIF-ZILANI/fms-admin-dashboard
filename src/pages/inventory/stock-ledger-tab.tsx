import { useState } from "react";
import { BookText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { StockLedgerEntry } from "@/pages/inventory/types";
import { AdjustmentFormDialog } from "@/pages/inventory/adjustment-form-dialog";

export function StockLedgerTab() {
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<StockLedgerEntry>>("/stock-ledger?limit=100", [
    "stock-ledger",
  ]);

  const columns: Column<StockLedgerEntry>[] = [
    {
      key: "date",
      header: "Date",
      render: (e) => new Date(e.occurred_at).toLocaleDateString(),
      sortValue: (e) => new Date(e.occurred_at).getTime(),
    },
    { key: "item", header: "Item", render: (e) => e.item.name, sortValue: (e) => e.item.name },
    {
      key: "direction",
      header: "Direction",
      render: (e) =>
        e.direction === "IN" ? (
          <StatusBadge tone="success" label="In" />
        ) : (
          <StatusBadge tone="info" label="Out" />
        ),
    },
    { key: "reason", header: "Reason", render: (e) => humanizeEnum(e.reason) },
    { key: "quantity", header: "Quantity", render: (e) => e.quantity, numeric: true },
    { key: "unit_cost", header: "Unit cost", render: (e) => e.unit_cost ?? "—", numeric: true },
    { key: "ref_type", header: "Ref type", render: (e) => humanizeEnum(e.ref_type) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setOpeningBalanceOpen(true)}>
          <Plus />
          Record opening balance
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: BookText,
          title: "No stock movements yet",
          description: "Every IN/OUT movement for tracked items will show up here.",
        }}
      />

      <AdjustmentFormDialog open={openingBalanceOpen} onOpenChange={setOpeningBalanceOpen} openingBalance />
    </div>
  );
}

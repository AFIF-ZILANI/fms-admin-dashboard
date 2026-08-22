import { useState } from "react";
import { BookText, PackageMinus, PackagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { STOCK_DIRECTIONS, STOCK_REASONS, type Item, type StockDirection, type StockLedgerEntry, type StockReason } from "@/pages/inventory/types";
import { AdjustmentFormDialog } from "@/pages/inventory/adjustment-form-dialog";

export function StockLedgerTab() {
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("ALL");
  const [directionFilter, setDirectionFilter] = useState<StockDirection | "ALL">("ALL");
  const [reasonFilter, setReasonFilter] = useState<StockReason | "ALL">("ALL");

  const query = new URLSearchParams({ limit: "100" });
  if (itemFilter !== "ALL") query.set("item_id", itemFilter);
  if (directionFilter !== "ALL") query.set("direction", directionFilter);
  if (reasonFilter !== "ALL") query.set("reason", reasonFilter);
  const { data, isLoading } = useGetData<Paginated<StockLedgerEntry>>(`/stock-ledger?${query}`, [
    "stock-ledger",
    itemFilter,
    directionFilter,
    reasonFilter,
  ]);

  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);

  // KPI counts always reflect the unfiltered full set, not the currently-filtered view --
  // fetched separately so applying a filter doesn't make the tiles change (same pattern as Coded Units).
  const { data: allEntries, isLoading: allEntriesLoading } = useGetData<Paginated<StockLedgerEntry>>(
    "/stock-ledger?limit=100",
    ["stock-ledger", "ALL", "ALL", "ALL"]
  );
  const allEntryResults = allEntries?.results ?? [];
  const totalEntries = allEntries?.total ?? allEntryResults.length;
  const inCount = allEntryResults.filter((e) => e.direction === "IN").length;
  const outCount = allEntryResults.filter((e) => e.direction === "OUT").length;

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
    {
      key: "movement",
      header: "Movement",
      render: (e) => (
        <span className={e.direction === "IN" ? "text-success" : "text-critical"}>
          {e.direction === "IN" ? "+" : "-"}
          {e.quantity} {e.item.unit}
        </span>
      ),
    },
    { key: "quantity", header: "Quantity", render: (e) => e.quantity, numeric: true },
    { key: "unit_cost", header: "Unit cost", render: (e) => e.unit_cost ?? "—", numeric: true },
    { key: "ref_type", header: "Ref type", render: (e) => humanizeEnum(e.ref_type) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total entries" value={totalEntries} icon={BookText} isLoading={allEntriesLoading} />
        <KPICard label="In movements" value={inCount} icon={PackagePlus} isLoading={allEntriesLoading} />
        <KPICard label="Out movements" value={outCount} icon={PackageMinus} isLoading={allEntriesLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => setOpeningBalanceOpen(true)}>
          <Plus />
          Record opening balance
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={itemFilter} onValueChange={(v) => setItemFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) => (v && v !== "ALL" ? items?.results.find((i) => i.id === v)?.name ?? "Item" : "All items")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All items</SelectItem>
            {(items?.results ?? []).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={directionFilter}
          onValueChange={(v) => setDirectionFilter((v ?? "ALL") as StockDirection | "ALL")}
        >
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All directions")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All directions</SelectItem>
            {STOCK_DIRECTIONS.map((direction) => (
              <SelectItem key={direction} value={direction}>
                {direction === "IN" ? "In" : "Out"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={(v) => setReasonFilter((v ?? "ALL") as StockReason | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All reasons")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All reasons</SelectItem>
            {STOCK_REASONS.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {humanizeEnum(reason)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

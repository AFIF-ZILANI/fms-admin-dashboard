import { useState } from "react";
import { ArrowRightLeft, BookText, PackageMinus, PackagePlus, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { STOCK_DIRECTIONS, STOCK_REASONS, type Item, type StockDirection, type StockLedgerEntry, type StockReason } from "@/pages/inventory/types";
import { AdjustmentFormDialog } from "@/pages/inventory/adjustment-form-dialog";
import { TransferFormDialog } from "@/pages/inventory/transfer-form-dialog";

type LedgerSummary = {
  total: number;
  in_30d: number;
  out_30d: number;
  loss_30d: number;
  received_value_30d: number;
};

const PAGE_SIZES = [10, 20, 50, 100] as const;

export function StockLedgerTab() {
  const [openingBalanceOpen, setOpeningBalanceOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("ALL");
  const [directionFilter, setDirectionFilter] = useState<StockDirection | "ALL">("ALL");
  const [reasonFilter, setReasonFilter] = useState<StockReason | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // Filter/size changes reshape the page set server-side, so they go back to page 1.
  const resetting = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  if (itemFilter !== "ALL") query.set("item_id", itemFilter);
  if (directionFilter !== "ALL") query.set("direction", directionFilter);
  if (reasonFilter !== "ALL") query.set("reason", reasonFilter);
  const { data, isLoading } = useGetData<Paginated<StockLedgerEntry>>(`/stock-ledger?${query}`, [
    "stock-ledger",
    itemFilter,
    directionFilter,
    reasonFilter,
    page,
    pageSize,
  ]);

  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);

  // Server-side aggregate, unaffected by filters or page (a client reduce over one page undercounts).
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useGetData<LedgerSummary>(
    "/stock-ledger/summary",
    ["stock-ledger", "summary"]
  );

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard label="Total entries" value={summary?.total.toLocaleString()} hint="all time" icon={BookText} isLoading={summaryLoading} isError={summaryError} />
        <KPICard label="In (30 days)" value={summary?.in_30d.toLocaleString()} hint="stock received" icon={PackagePlus} isLoading={summaryLoading} isError={summaryError} />
        <KPICard label="Out (30 days)" value={summary?.out_30d.toLocaleString()} hint="stock used or moved out" icon={PackageMinus} isLoading={summaryLoading} isError={summaryError} />
        <KPICard label="Received value" value={summary ? formatMoney(summary.received_value_30d) : undefined} hint="last 30 days, costed entries" icon={Wallet} isLoading={summaryLoading} isError={summaryError} />
        <KPICard
          label="Wastage / expired"
          value={summary?.loss_30d.toLocaleString()}
          hint="last 30 days"
          icon={Trash2}
          tone={summary && summary.loss_30d > 0 ? "warning" : undefined}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          <ArrowRightLeft />
          Move stock
        </Button>
        <Button onClick={() => setOpeningBalanceOpen(true)}>
          <Plus />
          Record opening balance
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={itemFilter} onValueChange={(v) => resetting(setItemFilter)(v ?? "ALL")}>
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
          onValueChange={(v) => resetting(setDirectionFilter)((v ?? "ALL") as StockDirection | "ALL")}
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
        <Select value={reasonFilter} onValueChange={(v) => resetting(setReasonFilter)((v ?? "ALL") as StockReason | "ALL")}>
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
        paginate={false}
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

      {data && data.total > PAGE_SIZES[0] && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} total
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => resetting(setPageSize)(Number(v))}>
              <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
                <SelectValue>{(v: string) => `${v} / page`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <TransferFormDialog open={transferOpen} onOpenChange={setTransferOpen} />
      <AdjustmentFormDialog open={openingBalanceOpen} onOpenChange={setOpeningBalanceOpen} openingBalance />
    </div>
  );
}

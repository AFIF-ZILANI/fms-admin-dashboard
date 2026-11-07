import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";
import { useGetData, type Paginated } from "@/lib/api";
import { formatTk, humanizeEnum } from "@/lib/utils";
import type { StockUnit } from "@/pages/inventory/types";
import type { PurchaseItemLine } from "@/pages/purchases/types";
import { BindCodeDialog } from "@/pages/inventory/bind-code-dialog";
import { CodePrintSheet } from "@/pages/inventory/code-print-sheet";

const copy = (text: string, what: string) =>
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Couldn't copy ${what.toLowerCase()}`)
  );

type PurchaseLotSheetProps = {
  /** A QR-tracked line of the purchase, or null when closed. */
  lot: PurchaseItemLine | null;
  /** Per-unit cost including the purchase's extra charges; omitted when there are none. */
  landedUnitCost?: number;
  onOpenChange: (open: boolean) => void;
};

/** One purchase line (lot) and the QR codes bound to it: copy one or all, reprint the labels, or bind
 *  the rest when the lot isn't fully coded yet. */
export function PurchaseLotSheet({ lot, landedUnitCost, onOpenChange }: PurchaseLotSheetProps) {
  const [bindOpen, setBindOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const queryClient = useQueryClient();

  // ponytail: one page of 100 -- the list shows "showing 100 of N" beyond that; page it if lots get that big.
  const { data, isLoading } = useGetData<Paginated<StockUnit>>(
    lot ? `/stock-units?purchase_item_id=${lot.id}&limit=100` : "",
    ["stock-units", "lot", lot?.id ?? ""],
    { enabled: !!lot }
  );
  const units = data?.results ?? [];
  const total = data?.total ?? 0;
  const ids = units.map((u) => u.id);

  const counts = units.reduce<Partial<Record<StockUnit["status"], number>>>(
    (acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }),
    {}
  );
  // unit_count is fixed by the first bind; until then the lot's size in bottles is unknown.
  const expected = lot?.unit_count ?? null;
  const canBindMore = expected === null || total < expected;

  return (
    <>
      <Sheet open={!!lot} onOpenChange={onOpenChange}>
        {lot && (
          <SheetContent className="sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{lot.item.name}</SheetTitle>
              <SheetDescription>
                {lot.quantity} {humanizeEnum(lot.unit).toLowerCase()} · {humanizeEnum(lot.item.category)}
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Fact label="Unit price" value={formatTk(lot.unit_price)} />
              <Fact label="Total" value={formatTk(lot.total_price)} />
              {landedUnitCost !== undefined && <Fact label="Real unit cost" value={formatTk(landedUnitCost)} />}
              <Fact label="Mfg date" value={lot.mfg_date ? new Date(lot.mfg_date).toLocaleDateString() : "—"} />
              <Fact
                label="Expires"
                value={lot.expiration_date ? new Date(lot.expiration_date).toLocaleDateString() : "—"}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">QR codes</p>
                  <p className="text-sm">
                    {isLoading ? "…" : expected === null ? `${total} coded` : `${total} of ${expected} bottles coded`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={!ids.length} onClick={() => copy(ids.join("\n"), "All codes")}>
                    <Copy />
                    Copy all
                  </Button>
                  <Button variant="outline" size="sm" disabled={!ids.length} onClick={() => setPrintOpen(true)}>
                    <Printer />
                    Print
                  </Button>
                  {canBindMore && (
                    <Button size="sm" onClick={() => setBindOpen(true)}>
                      <Link2 />
                      Bind
                    </Button>
                  )}
                </div>
              </div>

              {units.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(counts) as StockUnit["status"][]).map((s) => (
                    <StatusBadge key={s} tone={STOCK_UNIT_STATUS_TONE[s]} label={`${counts[s]} ${humanizeEnum(s).toLowerCase()}`} />
                  ))}
                </div>
              )}

              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : units.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
                  <QrCode className="size-6 text-muted-foreground" />
                  <p className="text-sm">No codes bound to this lot yet.</p>
                  <p className="text-xs text-muted-foreground">Bind printed labels so each bottle can be tracked.</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {units.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs break-all">{u.id}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge tone={STOCK_UNIT_STATUS_TONE[u.status]} label={humanizeEnum(u.status)} />
                          {u.houseAllocations[0]?.house?.name ?? "Warehouse"}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Copy code" onClick={() => copy(u.id, "Code")}>
                        <Copy />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {total > units.length && (
                <p className="text-xs text-muted-foreground">Showing {units.length} of {total} codes.</p>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>

      {lot && (
        <BindCodeDialog
          open={bindOpen}
          onOpenChange={(open) => {
            setBindOpen(open);
            // The first bind fixes the lot's unit_count, which lives on the purchase.
            if (!open) void queryClient.invalidateQueries({ queryKey: ["purchases"] });
          }}
          scopedLots={[lot]}
        />
      )}
      <CodePrintSheet ids={ids} open={printOpen} onOpenChange={setPrintOpen} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular-nums">{value}</p>
    </div>
  );
}

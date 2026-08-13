import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { QrCode } from "@/components/shared/qr-code";
import { DataTable, type Column } from "@/components/shared/data-table";
import { usePostData, useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Consumption, StockUnit } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
// Reuse the one STOCK_UNIT_STATUS_TONE mapping rather than keeping a second copy in sync (see status-tone.ts).
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";

type StockUnitDetailSheetProps = {
  unit: StockUnit | null;
  onOpenChange: (open: boolean) => void;
};

export function StockUnitDetailSheet({ unit, onOpenChange }: StockUnitDetailSheetProps) {
  const [relocateHouseId, setRelocateHouseId] = useState("");

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  // No stock_unit_id filter on GET /consumptions (out of scope for this redesign, see spec) --
  // fetch by item_id (bounded, same limit=100 convention as everywhere else) and narrow client-side.
  const itemId = unit?.purchase_item?.item.id;
  const { data: history } = useGetData<Paginated<Consumption>>(
    `/consumptions?item_id=${itemId}&limit=100`,
    ["consumptions", "stock-unit", unit?.id ?? ""],
    { enabled: !!itemId }
  );
  const unitHistory = (history?.results ?? []).filter((c) => c.stock_unit_id === unit?.id);

  const relocate = usePostData<StockUnit, { house_id: string }>(
    () => `/stock-units/${unit?.id}/relocate`,
    ["stock-units"]
  );
  const dispose = usePostData<StockUnit, void>(() => `/stock-units/${unit?.id}/dispose`, ["stock-units"]);

  const handleRelocate = () => {
    if (!relocateHouseId) return;
    relocate.mutate(
      { house_id: relocateHouseId },
      {
        onSuccess: () => {
          toast.success("Unit relocated");
          setRelocateHouseId("");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const handleDispose = () => {
    if (!confirm("Mark this unit as disposed? This can't be undone.")) return;
    dispose.mutate(undefined, {
      onSuccess: () => toast.success("Unit disposed"),
      onError: (error) => toast.error(error.message),
    });
  };

  const historyColumns: Column<Consumption>[] = [
    { key: "date", header: "Date", render: (c) => new Date(c.date).toLocaleDateString() },
    { key: "quantity", header: "Quantity", render: (c) => c.quantity, numeric: true },
    { key: "house", header: "House", render: (c) => c.house.name },
  ];

  return (
    <Sheet open={!!unit} onOpenChange={onOpenChange}>
      {unit && (
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Coded unit</SheetTitle>
            <SheetDescription>{unit.purchase_item?.item.name ?? "Unbound"}</SheetDescription>
          </SheetHeader>

          <QrCode value={unit.code} size={140} />

          <div className="flex items-center justify-center gap-2">
            <StatusBadge tone={STOCK_UNIT_STATUS_TONE[unit.status]} label={humanizeEnum(unit.status)} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">House</p>
              <p>{unit.house?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining qty</p>
              <p>{unit.remaining_quantity ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Consumption history</p>
            <DataTable
              columns={historyColumns}
              rows={unitHistory}
              rowKey={(c) => c.id}
              empty={{ icon: History, title: "No consumption recorded for this unit yet" }}
            />
          </div>

          {unit.status !== "DISPOSED" && (
            <SheetFooter className="flex-col items-stretch gap-2 sm:flex-col">
              <div className="flex items-center gap-2">
                <Select value={relocateHouseId} onValueChange={(v) => setRelocateHouseId(v ?? "")}>
                  <SelectTrigger className="flex-1">
                    <SelectValue>
                      {(v: string) => houses?.results.find((h) => h.id === v)?.name ?? "Relocate to…"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(houses?.results ?? []).map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleRelocate} disabled={!relocateHouseId || relocate.isPending}>
                  Relocate
                </Button>
              </div>
              <Button variant="destructive" onClick={handleDispose} disabled={dispose.isPending}>
                Mark disposed
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}

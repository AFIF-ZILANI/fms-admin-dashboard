import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { NumericInput } from "@/components/utils/NumaricInput";
import { StatusBadge } from "@/components/shared/status-badge";
import { QrCode } from "@/components/shared/qr-code";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { LAST_ADMIN_KEY } from "@/components/shared/actor-select";
import { apiFetch, ApiError, usePostData, useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Consumption, Item, StockUnit, Warehouse } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
// Reuse the one STOCK_UNIT_STATUS_TONE mapping rather than keeping a second copy in sync (see status-tone.ts).
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";

type StockUnitDetailSheetProps = {
  unit: StockUnit | null;
  onOpenChange: (open: boolean) => void;
};

type Admin = { id: string; profile: { id: string; name: string } };

export function StockUnitDetailSheet({ unit, onOpenChange }: StockUnitDetailSheetProps) {
  const [relocateHouseId, setRelocateHouseId] = useState("");
  const [relocating, setRelocating] = useState(false);
  // Optional link to the stock ledger -- see stock-allocation-form-dialog.tsx for the same idea
  // applied to a batch. Only meaningful for a bound unit (it has a known item).
  const [linkQuantity, setLinkQuantity] = useState("");
  const [linkUnit, setLinkUnit] = useState("");
  const [linkWarehouseId, setLinkWarehouseId] = useState("");
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: unitLookup } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => unitLookup?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);
  // No stock_unit_id filter on GET /consumptions (out of scope for this redesign, see spec) --
  // fetch by item_id (bounded, same limit=100 convention as everywhere else) and narrow client-side.
  const itemId = unit?.purchase_item?.item.id;
  const { data: history } = useGetData<Paginated<Consumption>>(
    `/consumptions?item_id=${itemId}&limit=100`,
    ["consumptions", "stock-unit", unit?.id ?? ""],
    { enabled: !!itemId }
  );
  const unitHistory = (history?.results ?? []).filter((c) => c.stock_unit_id === unit?.id);

  const dispose = usePostData<StockUnit, void>(() => `/stock-units/${unit?.id}/dispose`, ["stock-units"]);

  const currentHouse = unit?.houseAllocations?.[0]?.house ?? null;
  const boundItem = itemId ? items?.results.find((i) => i.id === itemId) : undefined;
  const canLink = !!boundItem;
  const usableLinkUnits = boundItem
    ? [
        { code: boundItem.unit, label: unitLabel(boundItem.unit) },
        ...(boundItem.itemUnits ?? [])
          .filter((u) => u.is_usable)
          .map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
      ]
    : [];

  const resolveRecordedBy = (): string | null => {
    const admin = admins?.results ?? [];
    const stored = localStorage.getItem(LAST_ADMIN_KEY);
    if (stored && admin.some((a) => a.profile.id === stored)) return stored;
    const fallback = admin[0]?.profile.id;
    if (fallback) localStorage.setItem(LAST_ADMIN_KEY, fallback);
    return fallback ?? null;
  };

  const resetLinkFields = () => {
    setLinkQuantity("");
    setLinkUnit("");
    setLinkWarehouseId("");
  };

  const performRelocate = async (house_id: string | null) => {
    if (!unit) return;
    const wantsLink = canLink && !!linkQuantity && !!linkUnit;
    const needsWarehousePick = currentHouse === null || house_id === null;
    setRelocating(true);

    let stock_transfer_id: string | undefined;
    if (wantsLink) {
      if (needsWarehousePick && !linkWarehouseId) {
        toast.error("Select which warehouse this move is from or to.");
        setRelocating(false);
        return;
      }
      const recorded_by_id = resolveRecordedBy();
      if (!recorded_by_id) {
        toast.error("No admins exist yet — add one before linking to the ledger.");
        setRelocating(false);
        return;
      }
      try {
        const transfer = await apiFetch<{ id: string }>("/stock-transfers", {
          method: "POST",
          body: JSON.stringify({
            item_id: boundItem!.id,
            from_location_type: currentHouse === null ? "WAREHOUSE" : "HOUSE",
            from_location_id: currentHouse === null ? linkWarehouseId : currentHouse.id,
            to_location_type: house_id === null ? "WAREHOUSE" : "HOUSE",
            to_location_id: house_id === null ? linkWarehouseId : house_id,
            quantity: Number(linkQuantity),
            unit: linkUnit,
            recorded_by_id,
          }),
        });
        stock_transfer_id = transfer.id;
      } catch (err) {
        setRelocating(false);
        toast.error(err instanceof ApiError ? err.message : "Could not record the ledger movement.");
        return;
      }
    }

    try {
      await apiFetch(`/stock-units/${unit.id}/relocate`, {
        method: "POST",
        body: JSON.stringify({ house_id, ...(stock_transfer_id && { stock_transfer_id }) }),
      });
      void queryClient.invalidateQueries({ queryKey: ["stock-units"] });
      void queryClient.invalidateQueries({ queryKey: ["stock-house-allocations"] });
      if (stock_transfer_id) void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
      toast.success(house_id === null ? "Unit returned to warehouse" : "Unit relocated");
      setRelocateHouseId("");
      resetLinkFields();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not relocate the unit.");
    } finally {
      setRelocating(false);
    }
  };

  const handleDispose = async () => {
    const ok = await confirm({
      title: "Mark unit disposed?",
      description: "Mark this unit as disposed? This can't be undone.",
      confirmLabel: "Mark disposed",
      destructive: true,
    });
    if (!ok) return;
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
    <>
      <Sheet open={!!unit} onOpenChange={onOpenChange}>
      {unit && (
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Coded unit</SheetTitle>
            <SheetDescription>{unit.purchase_item?.item.name ?? "Unbound"}</SheetDescription>
          </SheetHeader>

          <QrCode value={unit.id} size={140} />

          <div className="flex items-center justify-center gap-2">
            <StatusBadge tone={STOCK_UNIT_STATUS_TONE[unit.status]} label={humanizeEnum(unit.status)} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Current location</p>
              <p>{currentHouse?.name ?? "Warehouse"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bound at</p>
              <p>{unit.bound_at ? new Date(unit.bound_at).toLocaleDateString() : "—"}</p>
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
                <Button
                  variant="outline"
                  onClick={() => performRelocate(relocateHouseId)}
                  disabled={!relocateHouseId || relocating}
                >
                  Relocate
                </Button>
              </div>

              {canLink && (
                <div className="flex flex-col gap-2 rounded-md border border-border p-2">
                  <p className="text-xs font-medium text-muted-foreground">Link to stock ledger (optional)</p>
                  <div className="flex gap-2">
                    <NumericInput
                      allowDecimal
                      decimalPlaces={3}
                      className="flex-1"
                      placeholder="Quantity"
                      value={linkQuantity}
                      onChange={(e) => setLinkQuantity(e.target.value)}
                    />
                    <Select value={linkUnit} onValueChange={(v) => setLinkUnit(v ?? "")}>
                      <SelectTrigger className="w-28">
                        <SelectValue>{(v: string) => (v ? unitLabel(v) : "Unit")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {usableLinkUnits.map((u) => (
                          <SelectItem key={u.code} value={u.code}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Whichever of Relocate/Return the operator ends up clicking, at most one side
                      of that move is a warehouse -- unit at warehouse -> Relocate needs it as the
                      source; unit at a house -> Return needs it as the destination. */}
                  <Select value={linkWarehouseId} onValueChange={(v) => setLinkWarehouseId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => warehouses?.results.find((w) => w.id === v)?.name ?? "Select warehouse"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(warehouses?.results ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" onClick={() => performRelocate(null)} disabled={!currentHouse || relocating}>
                Return to warehouse
              </Button>
              <Button variant="destructive" onClick={handleDispose} disabled={dispose.isPending}>
                Mark disposed
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      )}
      </Sheet>
      {confirmDialog}
    </>
  );
}

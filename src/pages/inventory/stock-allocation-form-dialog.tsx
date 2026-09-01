import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { StatusBadge } from "@/components/shared/status-badge";
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";
import { LAST_ADMIN_KEY } from "@/components/shared/actor-select";
import { apiFetch, ApiError, useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Item, StockUnit, Warehouse } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

type StockAllocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Admin = { id: string; profile: { id: string; name: string } };

// Finds StockUnits one scan/paste at a time and batches them into a list, then moves the whole
// batch to one house, between houses, or back to the warehouse in a single submit -- fans out to
// the existing per-unit relocate endpoint (same one the detail sheet uses), Promise.allSettled so
// one conflicting unit doesn't sink the rest. Type isn't picked here -- the server infers
// allocate/reallocate/return per unit from each one's own current location.
export function StockAllocationFormDialog({ open, onOpenChange }: StockAllocationFormDialogProps) {
  const [code, setCode] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [houseId, setHouseId] = useState("");
  const [returnToWarehouse, setReturnToWarehouse] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Optional link to the stock ledger -- only offered when every unit in the batch is the same
  // (bound) item at the same current location, since one aggregate StockTransfer can only
  // represent one item moving from one place to one place.
  const [linkQuantity, setLinkQuantity] = useState("");
  const [linkUnit, setLinkUnit] = useState("");
  const [linkWarehouseId, setLinkWarehouseId] = useState("");

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: unitLookup } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => unitLookup?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);
  const queryClient = useQueryClient();

  const firstItemId = units[0]?.purchase_item?.item.id;
  const homogeneousItem =
    units.length > 0 && units.every((u) => u.purchase_item?.item.id === firstItemId)
      ? items?.results.find((i) => i.id === firstItemId)
      : undefined;
  const firstHouseKey = units[0]?.houseAllocations?.[0]?.house?.id ?? null;
  const sameLocation = units.every((u) => (u.houseAllocations?.[0]?.house?.id ?? null) === firstHouseKey);
  // null = every unit is currently at the warehouse; undefined = mixed locations, can't link.
  const currentHouseId = sameLocation ? firstHouseKey : undefined;
  const canLinkLedger = !!homogeneousItem && currentHouseId !== undefined;
  const needsWarehousePick = currentHouseId === null || returnToWarehouse;

  const usableLinkUnits = homogeneousItem
    ? [
        { code: homogeneousItem.unit, label: unitLabel(homogeneousItem.unit) },
        ...(homogeneousItem.itemUnits ?? [])
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

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const id = code.trim();
    if (!id) return;
    if (units.some((u) => u.id === id)) {
      setAddError("Already added.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const unit = await queryClient.fetchQuery({
        queryKey: ["stock-units", id],
        queryFn: () => apiFetch<StockUnit>(`/stock-units/${encodeURIComponent(id)}`),
      });
      if (unit.status === "DISPOSED") {
        setAddError("Disposed units can't be moved.");
        return;
      }
      setUnits((prev) => [...prev, unit]);
      setCode("");
    } catch (err) {
      setAddError(err instanceof ApiError ? `No code found matching "${id}".` : "Lookup failed.");
    } finally {
      setAdding(false);
    }
  };

  const removeUnit = (id: string) => setUnits((prev) => prev.filter((u) => u.id !== id));

  const actionLabel =
    units.length === 0
      ? returnToWarehouse
        ? "Return to warehouse"
        : "Allocate"
      : `${returnToWarehouse ? "Return" : "Allocate"} ${units.length} unit${units.length === 1 ? "" : "s"}`;
  const canSubmit = units.length > 0 && (returnToWarehouse || !!houseId) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const house_id = returnToWarehouse ? null : houseId;

    let stock_transfer_id: string | undefined;
    if (canLinkLedger && linkQuantity && linkUnit) {
      if (needsWarehousePick && !linkWarehouseId) {
        toast.error("Select which warehouse this batch is moving from or to.");
        setSubmitting(false);
        return;
      }
      const recorded_by_id = resolveRecordedBy();
      if (!recorded_by_id) {
        toast.error("No admins exist yet — add one before linking to the ledger.");
        setSubmitting(false);
        return;
      }
      try {
        const transfer = await apiFetch<{ id: string }>("/stock-transfers", {
          method: "POST",
          body: JSON.stringify({
            item_id: homogeneousItem!.id,
            from_location_type: currentHouseId === null ? "WAREHOUSE" : "HOUSE",
            from_location_id: currentHouseId === null ? linkWarehouseId : currentHouseId,
            to_location_type: returnToWarehouse ? "WAREHOUSE" : "HOUSE",
            to_location_id: returnToWarehouse ? linkWarehouseId : houseId,
            quantity: Number(linkQuantity),
            unit: linkUnit,
            recorded_by_id,
          }),
        });
        stock_transfer_id = transfer.id;
      } catch (err) {
        setSubmitting(false);
        toast.error(err instanceof ApiError ? err.message : "Could not record the ledger movement.");
        return;
      }
    }

    const results = await Promise.allSettled(
      units.map((u) =>
        apiFetch(`/stock-units/${u.id}/relocate`, {
          method: "POST",
          body: JSON.stringify({ house_id, ...(stock_transfer_id && { stock_transfer_id }) }),
        })
      )
    );
    setSubmitting(false);
    void queryClient.invalidateQueries({ queryKey: ["stock-units"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-house-allocations"] });
    if (stock_transfer_id) void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });

    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (succeeded) toast.success(`Moved ${succeeded} unit${succeeded === 1 ? "" : "s"}`);
    if (failed) toast.error(`${failed} unit${failed === 1 ? "" : "s"} could not be moved`);
    handleClose(false);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCode("");
      setAddError(null);
      setUnits([]);
      setHouseId("");
      setReturnToWarehouse(false);
      setLinkQuantity("");
      setLinkUnit("");
      setLinkWarehouseId("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate stock</DialogTitle>
          <DialogDescription>
            Scan or paste codes to build a batch, then move them all to a house, between houses, or
            back to the warehouse at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <form className="flex items-end gap-2" onSubmit={handleAdd}>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="code">Code (scan or paste id)</Label>
              <Input
                id="code"
                placeholder="Scan the QR or paste the unit id"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" variant="outline" disabled={!code.trim() || adding}>
              Add
            </Button>
          </form>
          {addError && <p className="text-xs text-destructive">{addError}</p>}

          {units.length > 0 && (
            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
              {units.map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm">
                  <span className="font-mono text-xs" title={u.id}>
                    {u.id.slice(0, 8)}
                  </span>
                  <StatusBadge tone={STOCK_UNIT_STATUS_TONE[u.status]} label={humanizeEnum(u.status)} />
                  <span className="flex-1 truncate text-muted-foreground">
                    {u.purchase_item?.item.name ?? "Unbound"} · {u.houseAllocations?.[0]?.house?.name ?? "Warehouse"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUnit(u.id)}
                    aria-label={`Remove ${u.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {units.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="house_id">Move to house</Label>
                <Select
                  value={houseId}
                  onValueChange={(v) => {
                    setHouseId(v ?? "");
                    setReturnToWarehouse(false);
                  }}
                  disabled={returnToWarehouse}
                >
                  <SelectTrigger id="house_id" className="w-full">
                    <SelectValue>
                      {(v: string) => houses?.results.find((h) => h.id === v)?.name ?? "Select house"}
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
              </div>
              <Button
                type="button"
                variant={returnToWarehouse ? "default" : "outline"}
                onClick={() => {
                  setReturnToWarehouse((prev) => !prev);
                  setHouseId("");
                }}
              >
                Return to warehouse
              </Button>
            </div>
          )}

          {canLinkLedger && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Link to stock ledger (optional) — records one aggregate movement of{" "}
                {homogeneousItem!.name} for this batch.
              </p>
              <div className="flex gap-2">
                <NumericInput
                  allowDecimal
                  decimalPlaces={3}
                  className="flex-1"
                  placeholder="Total quantity"
                  value={linkQuantity}
                  onChange={(e) => setLinkQuantity(e.target.value)}
                />
                <Select value={linkUnit} onValueChange={(v) => setLinkUnit(v ?? "")}>
                  <SelectTrigger className="w-32">
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
              {needsWarehousePick && (
                <Select value={linkWarehouseId} onValueChange={(v) => setLinkWarehouseId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) =>
                        warehouses?.results.find((w) => w.id === v)?.name ?? "Select warehouse"
                      }
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
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {actionLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

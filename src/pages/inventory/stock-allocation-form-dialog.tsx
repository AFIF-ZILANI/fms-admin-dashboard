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
import { StatusBadge } from "@/components/shared/status-badge";
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";
import { apiFetch, ApiError, useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { StockUnit } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";

type StockAllocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const queryClient = useQueryClient();

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
    const results = await Promise.allSettled(
      units.map((u) =>
        apiFetch(`/stock-units/${u.id}/relocate`, {
          method: "POST",
          body: JSON.stringify({ house_id }),
        })
      )
    );
    setSubmitting(false);
    void queryClient.invalidateQueries({ queryKey: ["stock-units"] });
    void queryClient.invalidateQueries({ queryKey: ["stock-house-allocations"] });

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

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { StockUnit } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";

type StockAllocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Finds a StockUnit by scanned/pasted id, then moves it: warehouse->house (ALLOCATION),
// house->house (REALLOCATION), or house->warehouse (RETURN). The type itself isn't picked here --
// the server infers it from the unit's current location, same endpoint the detail sheet uses.
export function StockAllocationFormDialog({ open, onOpenChange }: StockAllocationFormDialogProps) {
  const [code, setCode] = useState("");
  const [lookupId, setLookupId] = useState<string | null>(null);
  const [houseId, setHouseId] = useState("");
  const [returnToWarehouse, setReturnToWarehouse] = useState(false);

  const { data: foundUnit, isFetching: lookingUp } = useGetData<StockUnit>(
    `/stock-units/${encodeURIComponent(lookupId ?? "")}`,
    ["stock-units", lookupId ?? ""],
    { enabled: !!lookupId, retry: false }
  );
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);

  const currentHouse = foundUnit?.houseAllocations?.[0]?.house ?? null;
  const eligible = !!foundUnit && foundUnit.status !== "DISPOSED";

  const queryClient = useQueryClient();
  const relocate = usePostData<StockUnit, { house_id: string | null }>(
    () => `/stock-units/${foundUnit?.id}/relocate`,
    ["stock-units"]
  );

  const actionLabel = returnToWarehouse ? "Return to warehouse" : currentHouse ? "Reallocate" : "Allocate";
  const canSubmit = eligible && (returnToWarehouse ? !!currentHouse : !!houseId && houseId !== currentHouse?.id);

  const handleSubmit = () => {
    if (!canSubmit) return;
    relocate.mutate(
      { house_id: returnToWarehouse ? null : houseId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["stock-house-allocations"] });
          toast.success(`Unit ${actionLabel.toLowerCase()}d`);
          handleClose(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCode("");
      setLookupId(null);
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
            Move a coded unit to a house, between houses, or back to the warehouse.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="code">Code (scan or paste id)</Label>
              <Input
                id="code"
                placeholder="Scan the QR or paste the unit id"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setLookupId(code.trim())} disabled={!code.trim()}>
              Find
            </Button>
          </div>

          {lookupId && lookingUp && <p className="text-xs text-muted-foreground">Looking up…</p>}
          {lookupId && !lookingUp && !foundUnit && (
            <p className="text-xs text-destructive">No code found matching "{lookupId}".</p>
          )}

          {foundUnit && (
            <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{foundUnit.id.slice(0, 8)}</span>
                <StatusBadge tone={STOCK_UNIT_STATUS_TONE[foundUnit.status]} label={humanizeEnum(foundUnit.status)} />
              </div>
              <p className="text-muted-foreground">{foundUnit.purchase_item?.item.name ?? "Unbound"}</p>
              <p className="text-xs text-muted-foreground">Currently at: {currentHouse?.name ?? "Warehouse"}</p>
            </div>
          )}
          {foundUnit && !eligible && (
            <p className="text-xs text-destructive">Disposed units can't be moved.</p>
          )}

          {eligible && (
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
                    {(houses?.results ?? [])
                      .filter((h) => h.id !== currentHouse?.id)
                      .map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {currentHouse && (
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
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || relocate.isPending}>
              {actionLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

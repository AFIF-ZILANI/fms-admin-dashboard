import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Consumption, StockUnit } from "@/pages/inventory/types";
import { formatEntered } from "@/pages/inventory/stock-qty";
import type { LookupRow } from "@/pages/settings/lookup-types";

// Local calendar day: toISOString() is UTC, which is still "yesterday" until 06:00 in Bangladesh.
const localDay = (d: Date) => d.toLocaleDateString("en-CA");

/** GET /consumptions/:id: the record plus what the form needs to know before offering a fix. */
type ConsumptionDetail = Consumption & {
  batch: { id: string; batch_code: string; status: "RUNNING" | "SOLD" | "CLOSED" } | null;
  medications: { id: string; medicine_name: string }[];
  vaccinations: { id: string; vaccine_name: string; schedule_id: string | null }[];
};

type FixUsageDialogProps = {
  consumption: Consumption;
  onClose: () => void;
};

/** "Fix usage" (docs/usage-fix-design.md): correct a wrong usage record in place, or remove it. The server
 *  works out the difference and checks stock; this form only sends what changed, with a reason. Mount it
 *  with `key={consumption.id}` so its fields start from the record each time. */
export function FixUsageDialog({ consumption, onClose }: FixUsageDialogProps) {
  // Plain locals: the React Compiler memoizes optional reads in closures on the non-optional path.
  const id = consumption.id;
  const item = consumption.item;
  const currentUnit = consumption.stock_unit;
  const currentUnitId = currentUnit?.id ?? null;
  const coded = currentUnit !== null;
  const usedUp = currentUnit?.status === "CONSUMED";
  const equipment = item.category === "EQUIPMENT";
  const recordedDay = localDay(new Date(consumption.date));

  const [quantity, setQuantity] = useState(String(Number(consumption.quantity)));
  const [unit, setUnit] = useState(consumption.unit);
  const [code, setCode] = useState("");
  const [day, setDay] = useState(recordedDay);
  const [reason, setReason] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: detail } = useGetData<ConsumptionDetail>(`/consumptions/${id}`, ["consumptions", id]);
  const closed = detail?.batch?.status === "CLOSED";
  const links = [
    ...(detail?.medications ?? []).map((m) => `treatment ${m.medicine_name}`),
    ...(detail?.vaccinations ?? []).map((v) => (v.schedule_id ? `vaccine schedule step (${v.vaccine_name})` : `vaccination ${v.vaccine_name}`)),
  ];

  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (c: string) => units?.results.find((u) => u.code === c)?.label ?? humanizeEnum(c);
  const usableUnits = [item.unit, ...(item.itemUnits ?? []).filter((u) => u.is_usable && u.unit !== item.unit).map((u) => u.unit)];

  // The right bottle, by its code: the id is the QR payload, a fragment works (same lookup as Record by code).
  const q = code.trim();
  const { data: matches } = useGetData<Paginated<StockUnit>>(
    q.length >= 4 ? `/stock-units?q=${encodeURIComponent(q)}&limit=5` : "",
    ["stock-units", "code-lookup", q],
    { enabled: q.length >= 4 }
  );
  const newUnit = matches?.results.length === 1 ? matches.results[0] : undefined;
  const newUnitId = newUnit && newUnit.id !== currentUnitId ? newUnit.id : undefined;
  // Same gate as the server: only a bottle on the shelf or open can take the use.
  const newUnitUsable = newUnit?.status === "BOUND" || newUnit?.status === "IN_USE";
  const newUnitName = newUnit?.purchase_item?.item.name;
  const newUnitStatus = newUnit?.status;

  const amountEditable = !equipment && !usedUp;
  const quantityNum = Number(quantity);
  const body: Record<string, unknown> = {};
  if (amountEditable && quantityNum > 0 && quantityNum !== Number(consumption.quantity)) body.quantity = quantityNum;
  if (amountEditable && unit !== consumption.unit) body.unit = unit;
  if (newUnitId && newUnitUsable) body.stock_unit_id = newUnitId;
  if (day !== recordedDay)
    // Today: now (noon could still be ahead). Another day: noon, so the day doesn't shift across UTC.
    body.date = day === localDay(new Date()) ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
  const changed = Object.keys(body).length > 0;
  const canSave = changed && reason.trim().length > 0 && !closed && (!amountEditable || quantityNum > 0);

  const queryClient = useQueryClient();
  // A fix moves stock, batch cost, bottle status and the vaccine schedule: refetch whatever is on screen.
  const done = (message: string) => {
    toast.success(message);
    // Not this record's own read: after a removal it would 404, and the dialog is closing anyway.
    void queryClient.invalidateQueries({ predicate: (q) => !(q.queryKey[0] === "consumptions" && q.queryKey[1] === id) });
    onClose();
  };
  // The hook's own key matches nothing: done() refreshes everything except this record's read.
  const fix = usePatchData<unknown, Record<string, unknown>>(`/consumptions/${id}`, ["fix-usage"], {
    onSuccess: () => done("Usage fixed"),
    onError: (e) => toast.error(e.message),
  });
  const remove = usePostData<unknown, { reason: string }>(`/consumptions/${id}/remove`, ["fix-usage"], {
    onSuccess: () => done("Usage removed"),
    onError: (e) => toast.error(e.message),
  });
  const busy = fix.isPending || remove.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fix usage</DialogTitle>
          <DialogDescription>
            {formatEntered(consumption.quantity, consumption.unit, item)} {item.name} in {consumption.house.name}
            {consumption.batch ? `, batch ${consumption.batch.batch_code}` : ""} on {new Date(consumption.date).toLocaleDateString()}.
            Enter what really happened; stock and the batch's cost follow.
          </DialogDescription>
        </DialogHeader>

        {closed && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Batch {detail?.batch?.batch_code} is closed, so this record can't be changed.
          </p>
        )}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) return fix.mutate({ ...body, reason: reason.trim() });
          }}
        >
          {amountEditable ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fix-quantity">Quantity</Label>
                <NumericInput
                  id="fix-quantity"
                  allowDecimal
                  decimalPlaces={3}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-invalid={!(quantityNum > 0)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fix-unit">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v ?? unit)}>
                  <SelectTrigger id="fix-unit" className="w-full">
                    <SelectValue>{(v: string) => unitLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {usableUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {unitLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            usedUp && (
              <p className="text-xs text-muted-foreground">
                This bottle was used up, so the amount is what was left in it. Change the bottle, or remove the record.
              </p>
            )
          )}

          {coded && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fix-code">Right bottle (only if the wrong one was scanned)</Label>
              <Input
                id="fix-code"
                autoComplete="off"
                className="font-mono"
                placeholder={`Now ${currentUnitId?.slice(0, 8) ?? ""}… — type the right code`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {q.length > 0 && q.length < 4 && <p className="text-xs text-muted-foreground">Type at least 4 characters.</p>}
              {matches && matches.results.length === 0 && <p className="text-xs text-destructive">No unit with this code.</p>}
              {matches && matches.results.length > 1 && (
                <p className="text-xs text-muted-foreground">Matches {matches.total} units — type more of the code.</p>
              )}
              {newUnit && !newUnitId && <p className="text-xs text-muted-foreground">That's the bottle already on this record.</p>}
              {newUnitId && (
                <p className="text-xs text-muted-foreground">
                  {newUnitName ?? "Unknown item"} · <span className="font-mono">{newUnitId.slice(0, 8)}</span> ·{" "}
                  {newUnitStatus && humanizeEnum(newUnitStatus)}
                </p>
              )}
              {newUnitId && !newUnitUsable && (
                <p className="text-xs text-destructive">That bottle is {newUnitStatus && humanizeEnum(newUnitStatus).toLowerCase()}, so it can't be used.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-date">Date</Label>
            <Input id="fix-date" type="date" max={localDay(new Date())} value={day} onChange={(e) => setDay(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fix-reason">Why (required)</Label>
            <Input
              id="fix-reason"
              placeholder="e.g. typed 2 kg, it was 2 bags"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {confirmRemove && (
            <div className="rounded-md border border-destructive/40 p-3 text-sm">
              <p className="font-medium">Remove this usage?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Stock goes back to the house{coded ? " and the bottle" : ""}.
                {links.length > 0 && ` Its ${links.join(", ")} will be removed too.`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!reason.trim() || busy}
                  onClick={() => remove.mutate({ reason: reason.trim() })}
                >
                  {remove.isPending && <Loader2 className="animate-spin" />}
                  Remove
                </Button>
              </div>
              {!reason.trim() && <p className="mt-2 text-xs text-destructive">Write why above first.</p>}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive" disabled={closed || busy} onClick={() => setConfirmRemove(true)}>
              <Trash2 />
              Remove this usage
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave || busy}>
                {fix.isPending && <Loader2 className="animate-spin" />}
                Save fix
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

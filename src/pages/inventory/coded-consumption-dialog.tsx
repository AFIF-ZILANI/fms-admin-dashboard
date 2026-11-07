import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { StockUnit } from "@/pages/inventory/types";

// Local calendar day: toISOString() is UTC, which is still "yesterday" until 06:00 in Bangladesh.
const today = () => new Date().toLocaleDateString("en-CA");

type BatchHouseBalance = { batch_id: string; house_id: string; quantity: number; batch?: { batch_code: string } };

// Same gates the server applies on POST /stock-units/:id/use -- shown up front instead of as an error toast.
const BLOCKED: Partial<Record<StockUnit["status"], string>> = {
  UNASSIGNED: "Not linked to a purchase yet.",
  PRINTED: "Not linked to a purchase yet.",
  CONSUMED: "Already used up.",
  DISPOSED: "Already disposed.",
};

function blockReason(unit: StockUnit): string | null {
  const blocked = BLOCKED[unit.status];
  if (blocked) return blocked;
  if (!unit.purchase_item) return "This unit has no purchase record.";
  if (unit.purchase_item.item.category === "EQUIPMENT") return "Equipment isn't used up — dispose it from Coded units.";
  if (!unit.houseAllocations[0]?.house_id) return "It's in the warehouse — move it to a house first.";
  return null;
}

type CodedConsumptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The web counterpart of mobile's "Use an item → Consumed": a coded unit (medicine/vaccine) is logged used
 *  up by its code -- typed, pasted, or from a USB scanner (which types the id and Enter). The house is where
 *  the unit is now; the server logs what was left in it as a consumption and marks it CONSUMED. */
export function CodedConsumptionDialog({ open, onOpenChange }: CodedConsumptionDialogProps) {
  const [code, setCode] = useState("");
  const [date, setDate] = useState(today());
  const codeRef = useRef<HTMLInputElement>(null);
  const q = code.trim();

  // The id IS the QR payload; a fragment works too (the Coded units tab shows the first 8 characters).
  const { data: matches, isFetching } = useGetData<Paginated<StockUnit>>(
    q.length >= 4 ? `/stock-units?q=${encodeURIComponent(q)}&limit=5` : "",
    ["stock-units", "code-lookup", q],
    { enabled: q.length >= 4 }
  );
  const unit = matches?.results.length === 1 ? matches.results[0] : undefined;
  const reason = unit ? blockReason(unit) : null;
  const house = unit?.houseAllocations[0]?.house;
  const houseId = unit?.houseAllocations[0]?.house_id ?? "";

  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    houseId ? `/batch-house-balances?house_id=${houseId}&limit=20` : "",
    ["batch-house-balances", "house", houseId],
    { enabled: !!houseId }
  );
  // The batch in the house when it was used -- the draw's cost lands on that batch.
  const batch = balances?.results.find((b) => b.quantity > 0);

  const queryClient = useQueryClient();
  // The body carries id too; the server's schema drops unknown keys.
  const recordUsed = usePostData<unknown, { id: string } & Record<string, unknown>>(
    (v) => `/stock-units/${v.id}/use`,
    ["consumptions"]
  );

  const close = (next: boolean) => {
    if (!next) {
      setCode("");
      setDate(today());
    }
    onOpenChange(next);
  };

  const canSubmit = !!unit && !reason && !recordUsed.isPending;

  const submit = () => {
    if (!unit || reason) return;
    recordUsed.mutate(
      {
        id: unit.id,
        action: "FINISH",
        house_id: houseId,
        // Noon local time, so the picked day doesn't shift across the UTC boundary.
        date: new Date(`${date}T12:00:00`).toISOString(),
        ...(batch && { batch_id: batch.batch_id }),
      },
      {
        onSuccess: () => {
          toast.success(`${unit.purchase_item?.item.name ?? "Unit"} recorded as used up`);
          for (const key of ["consumptions", "stock-units", "stock-ledger", "stock-at-location", "items", "house-stock"]) {
            void queryClient.invalidateQueries({ queryKey: [key] });
          }
          // Stay open for the next code: entering several in a row is the common case.
          setCode("");
          codeRef.current?.focus();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record coded unit used</DialogTitle>
          <DialogDescription>
            A medicine or vaccine unit that is finished. What was left in it is logged as used in the house it's in,
            and it leaves stock.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coded-consumption-code">Code</Label>
            <Input
              id="coded-consumption-code"
              ref={codeRef}
              autoFocus
              autoComplete="off"
              className="font-mono"
              placeholder="Scan or type the code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {q.length > 0 && q.length < 4 && (
              <p className="text-xs text-muted-foreground">Type at least 4 characters.</p>
            )}
            {q.length >= 4 && isFetching && !matches && (
              <p className="text-xs text-muted-foreground">Looking up…</p>
            )}
            {matches && matches.results.length === 0 && (
              <p className="text-xs text-destructive">No unit with this code.</p>
            )}
            {matches && matches.results.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Matches {matches.total} units — type more of the code.
              </p>
            )}
          </div>

          {unit && (
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{unit.purchase_item?.item.name ?? "Unknown item"}</p>
              <p className="font-mono text-xs text-muted-foreground">{unit.id}</p>
              {reason ? (
                <p className="mt-2 text-xs text-destructive">{reason}</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  In {house?.name ?? "house"} ·{" "}
                  {batch ? `charged to batch ${batch.batch?.batch_code ?? ""}` : "no batch in this house — recorded without one"}
                  {unit.status === "IN_USE" ? " · opened" : " · sealed"}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coded-consumption-date">Date</Label>
            <Input
              id="coded-consumption-date"
              type="date"
              max={today()}
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Done
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {recordUsed.isPending && <Loader2 className="animate-spin" />}
              Record as used up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

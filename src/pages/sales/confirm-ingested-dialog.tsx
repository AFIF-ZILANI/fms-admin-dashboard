import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import { BIRD_GRADES, type BirdGrade } from "@/pages/sales/types";
import { portionFigures, type IngestedSale } from "@/pages/sales/ingest-types";

type ConfirmIngestedDialogProps = {
  row: IngestedSale | null;
  onOpenChange: (open: boolean) => void;
};

/** A day is the threshold because an offline phone syncing the next morning is
 * normal; a week's gap means someone's clock is wrong. */
const STALE_MS = 24 * 60 * 60 * 1000;

/** Remounted per row via `key`, so every field's initial value comes straight
 * from that row's payload -- no effect syncing state back and forth. */
export function ConfirmIngestedDialog({ row, onOpenChange }: ConfirmIngestedDialogProps) {
  if (!row) return null;
  return <ConfirmForm key={row.id} row={row} onOpenChange={onOpenChange} />;
}

function ConfirmForm({ row, onOpenChange }: { row: IngestedSale; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const figures = portionFigures(row);
  const isCull = row.portion === "cull";

  // Pre-filled from the payload, all editable: the crate->katha and
  // deduction->dholta mappings are assumptions a person has to be able to fix.
  const [batchOverride, setBatchOverride] = useState<string | null>(null);
  const [houseId, setHouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [grade, setGrade] = useState<BirdGrade>(isCull ? "CULL" : "HIGH");
  const [birdsCount, setBirdsCount] = useState(figures.birds !== null ? String(figures.birds) : "");
  const [totalKatha, setTotalKatha] = useState(String(Math.round(figures.crates)));
  const [dholta, setDholta] = useState(String(figures.deductionPerCrateG));
  const [netWeight, setNetWeight] = useState(String(figures.netWeight));
  const [totalWeight, setTotalWeight] = useState(String(figures.totalWeight));
  const [pricePerKg, setPricePerKg] = useState(figures.pricePerKg.toFixed(2));
  const [paidAmount, setPaidAmount] = useState(String(row.payload.received_amount));
  const [discount, setDiscount] = useState(
    String(Math.max(0, row.payload.final_amount - row.payload.received_amount))
  );
  const [dismissReason, setDismissReason] = useState("");

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);

  const confirm = usePostData<unknown, Record<string, unknown>>(
    () => `/ingest/v1/sales/${row?.id}/confirm`,
    ["ingest"]
  );
  const dismiss = usePostData<unknown, Record<string, unknown>>(
    () => `/ingest/v1/sales/${row?.id}/dismiss`,
    ["ingest"]
  );

  // Derived during render rather than synced by an effect: the batch list loads
  // after mount, so the guess appears as soon as it arrives unless overridden.
  const guessedBatchId =
    batches?.results.find((b) => b.batch_code === row.payload.batch_name)?.id ?? "";
  const batchId = batchOverride ?? guessedBatchId;

  const selectedBatch = batches?.results.find((b) => b.id === batchId);
  const houseOptions = (selectedBatch?.houseBalances ?? []).filter((hb) => hb.quantity > 0);

  const serverTotal = (Number(netWeight) || 0) * (Number(pricePerKg) || 0);
  const deviceTotal = figures.amount;
  const totalsDisagree = Math.abs(serverTotal - deviceTotal) > 1;
  const clockSkewed =
    Math.abs(new Date(row.received_at).getTime() - new Date(row.device_sale_date).getTime()) >
    STALE_MS;

  const handleConfirm = () => {
    if (!batchId || !houseId) {
      toast.error("Batch and house are required");
      return;
    }
    confirm.mutate(
      {
        batch_id: batchId,
        house_id: houseId,
        grade,
        birds_count: Number(birdsCount),
        dholta_in_g: Number(dholta),
        total_katha: Number(totalKatha),
        total_weight: Number(totalWeight),
        net_weight: Number(netWeight),
        price_per_kg: Number(pricePerKg),
        paid_amount: Number(paidAmount),
        discount_amount: Number(discount),
        ...(customerId ? { customer_id: customerId } : {}),
      },
      {
        onSuccess: () => {
          // A confirmed sale moves stock and money -- every sibling cache that
          // reads either has to refetch, same rule the sale dialogs follow.
          void queryClient.invalidateQueries({ queryKey: ["bird-sales"] });
          void queryClient.invalidateQueries({ queryKey: ["sales"] });
          void queryClient.invalidateQueries({ queryKey: ["analytics"] });
          void queryClient.invalidateQueries({ queryKey: ["batches"] });
          toast.success("Sale confirmed");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.fieldError("amount") ?? error.message),
      }
    );
  };

  const handleDismiss = () => {
    if (!dismissReason.trim()) {
      toast.error("A reason is required to dismiss");
      return;
    }
    dismiss.mutate(
      { reason: dismissReason.trim() },
      {
        onSuccess: () => {
          toast.success("Sale dismissed");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Confirm incoming sale · {isCull ? "Cull birds" : "Main birds"}
          </DialogTitle>
          <DialogDescription>
            From {row.device.label}, recorded as {row.recorded_by.name}. Confirming creates a bird
            sale and reduces the batch's live count.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {(totalsDisagree || clockSkewed) && (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
              {totalsDisagree && (
                <p className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  The phone recorded {formatMoney(deviceTotal)} for this portion; FMS computes{" "}
                  {formatMoney(serverTotal)}.
                </p>
              )}
              {clockSkewed && (
                <p className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  Dated {new Date(row.device_sale_date).toLocaleDateString()} on the phone but
                  received {new Date(row.received_at).toLocaleDateString()}.
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What the phone sent
            </p>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Buyer</dt>
                <dd>{row.payload.buyer_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Bird count</dt>
                <dd className="tabular-nums">{figures.birds ?? "not counted"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Net weight</dt>
                <dd className="tabular-nums">{figures.netWeight} kg</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Crates</dt>
                <dd className="tabular-nums">{figures.crates}</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_batch">Batch</Label>
              <Select value={batchId} onValueChange={(v) => setBatchOverride(v ?? "")}>
                <SelectTrigger id="ci_batch" className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      batches?.results.find((b) => b.id === v)?.batch_code ?? "Select batch"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(batches?.results ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_house">House</Label>
              <Select value={houseId} onValueChange={(v) => setHouseId(v ?? "")} disabled={!batchId}>
                <SelectTrigger id="ci_house" className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      houseOptions.find((hb) => hb.house_id === v)?.house.name ?? "Select house"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {houseOptions.map((hb) => (
                    <SelectItem key={hb.house_id} value={hb.house_id}>
                      {hb.house.name} ({hb.quantity} live)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_grade">Grade</Label>
              <Select
                value={grade}
                onValueChange={(v) => setGrade((v ?? "HIGH") as BirdGrade)}
                disabled={isCull}
              >
                <SelectTrigger id="ci_grade" className="w-full">
                  <SelectValue>{(v: string) => humanizeEnum(v || "HIGH")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BIRD_GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {humanizeEnum(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_customer">Customer (optional)</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                <SelectTrigger id="ci_customer" className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      customers?.results.find((c) => c.id === v)?.profile.name ?? "None"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(customers?.results ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_birds">Bird count</Label>
              <Input
                id="ci_birds"
                type="number"
                value={birdsCount}
                onChange={(e) => setBirdsCount(e.target.value)}
              />
              {figures.birds === null && (
                <p className="text-xs text-muted-foreground">
                  The phone weighed without counting — enter the count.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">
              Mapped from the device's crate count and per-crate deduction — check these before
              confirming.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ci_katha">Total katha</Label>
                <Input
                  id="ci_katha"
                  type="number"
                  value={totalKatha}
                  onChange={(e) => setTotalKatha(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ci_dholta">Dholta (g)</Label>
                <Input
                  id="ci_dholta"
                  type="number"
                  step="0.01"
                  value={dholta}
                  onChange={(e) => setDholta(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_total_wt">Total weight (kg)</Label>
              <Input
                id="ci_total_wt"
                type="number"
                step="0.01"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_net_wt">Net weight (kg)</Label>
              <Input
                id="ci_net_wt"
                type="number"
                step="0.01"
                value={netWeight}
                onChange={(e) => setNetWeight(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_price">Price per kg</Label>
              <Input
                id="ci_price"
                type="number"
                step="0.01"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_paid">Paid amount</Label>
              <Input
                id="ci_paid"
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ci_discount">Discount</Label>
              <Input
                id="ci_discount"
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The shortfall the phone recorded — money knocked off, not owed.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ci_dismiss">Dismiss instead — reason</Label>
            <Input
              id="ci_dismiss"
              placeholder="e.g. already entered by hand"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end text-sm font-medium tabular-nums">
          Total: {formatMoney(serverTotal)} · Due:{" "}
          {formatMoney(Math.max(0, serverTotal - Number(discount || 0) - Number(paidAmount || 0)))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={handleDismiss}
            disabled={dismiss.isPending}
          >
            Dismiss
          </Button>
          <Button onClick={handleConfirm} disabled={confirm.isPending}>
            Confirm sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

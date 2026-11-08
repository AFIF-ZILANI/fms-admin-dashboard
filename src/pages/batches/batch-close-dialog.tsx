import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, usePostData } from "@/lib/api";
import { liveBirdCount, type Batch, type BatchStatus } from "@/pages/batches/types";

type BatchCloseDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function BatchCloseDialog({ open, onOpenChange, batch }: BatchCloseDialogProps) {
  // Sold is the usual end: the books stay open for late litter sales, bottles and bills.
  const [status, setStatus] = useState<Extract<BatchStatus, "CLOSED" | "SOLD">>("SOLD");
  const remaining = liveBirdCount(batch);
  const settings = useGetData<{ settlement_days: number }>("/farm-settings", ["farm-settings"]);
  const days = settings.data?.settlement_days ?? 7;

  const close = usePostData<Batch, { status: string; force?: boolean }>(`/batches/${batch.id}/close`, ["batches"]);

  const submit = (force: boolean) => {
    close.mutate(
      { status, ...(force ? { force: true } : {}) },
      {
        onSuccess: () => {
          toast.success("Batch closed");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Close batch</DialogTitle>
          <DialogDescription>{batch.batch_code}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Select value={status} onValueChange={(v) => setStatus(v as "CLOSED" | "SOLD")}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v: string) => (v === "SOLD" ? "Sold — open for late entries" : "Close now (final)")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOLD">Sold — open for late entries</SelectItem>
              <SelectItem value="CLOSED">Close now (final)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {status === "SOLD"
              ? `Late costs and income (litter sales, missed bottles, bills) can still be added for ${days} day${days === 1 ? "" : "s"}. Then the batch's books are final.`
              : "The batch's books are final straight away. Nothing more can be added to it."}
          </p>

          {remaining !== 0 && (
            <p className="rounded-md border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
              This batch still has {remaining.toLocaleString()} live birds allocated across its houses. Closing now
              requires an explicit override.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {remaining !== 0 ? (
            <Button variant="destructive" onClick={() => submit(true)} disabled={close.isPending}>
              Close anyway ({remaining} unaccounted)
            </Button>
          ) : (
            <Button onClick={() => submit(false)} disabled={close.isPending}>
              Close batch
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

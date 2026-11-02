import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { ApiError } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { blankChickPurchase, chickProblem, chickTotals, useChickPurchase, type ChickPurchase } from "@/pages/batches/chick-purchase";
import { ChickPaymentFields, ChickPurchaseFields, PaymentStatusSelect } from "@/pages/batches/chick-purchase-fields";
import type { Batch } from "@/pages/batches/types";

/** A chick purchase for a batch that already exists: a second delivery, or the first one when it
 *  wasn't recorded on New batch. Records the cost only; birds are placed into houses separately. */
export function ChickDeliveryDialog({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [date, setDate] = useState(farmToday);
  const [chicks, setChicks] = useState<ChickPurchase>(() => blankChickPurchase(farmToday()));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setChick = (patch: Partial<ChickPurchase>) => setChicks((c) => ({ ...c, ...patch }));
  const chickPurchase = useChickPurchase();
  const { total } = chickTotals(chicks, 0);

  const save = async () => {
    const issue = chickProblem(chicks, 0, chickPurchase.hasWarehouse) ?? (date ? null : "Pick the delivery date.");
    setProblem(issue);
    if (issue) return;
    setSaving(true);
    try {
      await chickPurchase.record(batch.id, chicks, 0, date);
      toast.success("Chick delivery recorded");
      onClose();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add chick delivery</DialogTitle>
          <DialogDescription>
            Chicks bought for {batch.batch_code}. The cost goes into this batch's P&L. Place the birds into a house
            separately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 sm:w-1/2">
          <Label htmlFor="delivery_date">Delivery date</Label>
          <Input id="delivery_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <ChickPurchaseFields
          chicks={chicks}
          setChick={setChick}
          defaultBilled={0}
          suppliers={chickPurchase.suppliers?.results ?? []}
          showNewItemNote={!chickPurchase.chickItem}
        />

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Payment</span>
            <PaymentStatusSelect value={chicks.status} onChange={(status) => setChick({ status })} />
          </div>
          <ChickPaymentFields chicks={chicks} setChick={setChick} total={total} />
        </div>

        {problem && <p className="text-sm text-destructive">{problem}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Record delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

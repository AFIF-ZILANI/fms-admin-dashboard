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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { LookupRow } from "@/pages/settings/lookup-types";

type PurchaseChargeDialogProps = {
  purchaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

// A charge that arrives after the purchase (the transport bill). The server re-costs the stock with it,
// including whatever a batch already used, so batch P&L shows the real cost.
export function PurchaseChargeDialog({ purchaseId, open, onOpenChange }: PurchaseChargeDialogProps) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [remarks, setRemarks] = useState("");
  const [paid, setPaid] = useState(true);
  const [instrumentId, setInstrumentId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useGetData<Paginated<LookupRow>>("/expense-categories?active=true&limit=100", [
    "expense-categories",
    "active",
  ]);
  // Invalidates the purchase (its charges) and expenses -- both show this row.
  const addCharge = usePostData<unknown, Record<string, unknown>>(`/purchases/${purchaseId}/charges`, ["purchases"], {
    onSuccess: () => toast.success("Charge added — item costs updated"),
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setCategory("");
      setAmount("");
      setDate(today());
      setRemarks("");
      setPaid(true);
      setInstrumentId("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!category) return setError("Select a category.");
    if (!(value > 0)) return setError("Enter a valid amount.");
    if (paid && !instrumentId) return setError("Select the account it was paid from.");
    addCharge.mutate(
      {
        category,
        amount: value,
        date,
        remarks: remarks.trim() || undefined,
        paid_amount: paid ? value : 0,
        paid_from_instrument_id: paid ? instrumentId : undefined,
      },
      {
        onSuccess: () => handleClose(false),
        onError: (err) => setError(Object.values(err.fields ?? {})[0] ?? err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add charge</DialogTitle>
          <DialogDescription>
            Transport, labour or unloading for this purchase. It's added to the items' cost, split by value.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      v ? (categories?.results.find((c) => c.code === v)?.label ?? humanizeEnum(v)) : "Select category"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(categories?.results ?? []).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="charge-amount">Amount</Label>
              <NumericInput
                id="charge-amount"
                allowDecimal
                decimalPlaces={2}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="charge-date">Date</Label>
              <Input id="charge-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="charge-remarks">Remarks (optional)</Label>
              <Input id="charge-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid on the spot
          </label>
          {paid && <FarmAccountSelect value={instrumentId} onChange={setInstrumentId} />}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addCharge.isPending}>
              {addCharge.isPending && <Loader2 className="animate-spin" />}
              Add charge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

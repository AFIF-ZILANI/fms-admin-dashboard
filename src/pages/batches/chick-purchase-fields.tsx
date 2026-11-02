import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput, PositiveIntegerInput } from "@/components/utils/NumaricInput";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { formatMoney } from "@/lib/utils";
import type { Supplier } from "@/pages/suppliers/types";
import {
  CHICK_ITEM_NAME,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  chickTotals,
  type ChickPurchase,
  type PaymentStatus,
} from "@/pages/batches/chick-purchase";

/** Supplier, invoice, price, count and the running total. */
export function ChickPurchaseFields({
  chicks,
  setChick,
  defaultBilled,
  suppliers,
  showNewItemNote,
  sameAsPlaced = false,
}: {
  chicks: ChickPurchase;
  setChick: (patch: Partial<ChickPurchase>) => void;
  defaultBilled: number;
  /** New batch: an empty "Chicks billed" means the chicks placed. */
  sameAsPlaced?: boolean;
  suppliers: Supplier[];
  showNewItemNote: boolean;
}) {
  const { billed, unitPrice, total } = chickTotals(chicks, defaultBilled);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplier">Supplier / hatchery</Label>
        <Select value={chicks.supplier_id} onValueChange={(v) => setChick({ supplier_id: v ?? "" })}>
          <SelectTrigger id="supplier" className="w-full">
            <SelectValue>{(v: string) => suppliers.find((s) => s.id === v)?.profile.name ?? "Select supplier"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoice_no">Invoice no. (optional)</Label>
        <Input id="invoice_no" value={chicks.invoice_no} onChange={(e) => setChick({ invoice_no: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unit_price">Price per chick</Label>
        <NumericInput
          id="unit_price"
          allowDecimal
          decimalPlaces={2}
          placeholder="e.g. 45"
          value={chicks.unit_price}
          onChange={(e) => setChick({ unit_price: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="billed">Chicks billed</Label>
        <PositiveIntegerInput
          id="billed"
          placeholder={sameAsPlaced ? (defaultBilled ? String(defaultBilled) : "Same as placed") : "e.g. 1000"}
          value={chicks.billed}
          onChange={(e) => setChick({ billed: e.target.value })}
        />
        {sameAsPlaced && (
          <p className="text-xs text-muted-foreground">Leave empty if it's the same as the chicks placed.</p>
        )}
      </div>
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:col-span-2">
        <span className="text-muted-foreground">
          {billed || 0} × {formatMoney(Number.isFinite(unitPrice) ? unitPrice : 0)}
        </span>
        <span className="font-medium tabular-nums">{formatMoney(total)}</span>
      </div>
      {showNewItemNote && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          A "{CHICK_ITEM_NAME}" item (Chicks, pcs) will be added to the catalog for this purchase.
        </p>
      )}
    </div>
  );
}

/** Amount, account, date and reference, once the status says something was paid. */
export function ChickPaymentFields({
  chicks,
  setChick,
  total,
}: {
  chicks: ChickPurchase;
  setChick: (patch: Partial<ChickPurchase>) => void;
  total: number;
}) {
  if (chicks.status === "UNPAID") {
    return (
      <p className="text-xs text-muted-foreground">{formatMoney(total)} stays due to the supplier — pay it later from Payments.</p>
    );
  }
  const paid = chicks.status === "PAID" ? total : Number(chicks.amount);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label>Amount</Label>
        <NumericInput
          allowDecimal
          decimalPlaces={2}
          disabled={chicks.status === "PAID"}
          value={chicks.status === "PAID" ? String(total) : chicks.amount}
          onChange={(e) => setChick({ amount: e.target.value })}
        />
        {chicks.status === "PARTIAL" && (
          <p className="text-xs text-muted-foreground">Due after this payment: {formatMoney(Math.max(0, total - (paid || 0)))}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from_instrument">Paid from</Label>
        <FarmAccountSelect id="from_instrument" value={chicks.from_instrument_id} onChange={(v) => setChick({ from_instrument_id: v })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Payment date</Label>
        <Input type="date" value={chicks.payment_date} onChange={(e) => setChick({ payment_date: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Transaction ref (optional)</Label>
        <Input value={chicks.transaction_ref} onChange={(e) => setChick({ transaction_ref: e.target.value })} />
      </div>
    </div>
  );
}

export function PaymentStatusSelect({
  value,
  onChange,
}: {
  value: PaymentStatus;
  onChange: (status: PaymentStatus) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as PaymentStatus) ?? "UNPAID")}>
      <SelectTrigger className="w-44">
        <SelectValue>{(v: PaymentStatus) => PAYMENT_STATUS_LABELS[v]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {PAYMENT_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

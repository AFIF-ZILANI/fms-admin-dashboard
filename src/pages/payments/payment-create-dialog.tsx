import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useOutstanding } from "@/pages/sales/use-outstanding";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { cn, formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import type { Expense } from "@/pages/finance/types";
import type { Purchase } from "@/pages/purchases/types";
import type { Sale, BirdSale } from "@/pages/sales/types";
import { paymentStatus } from "@/pages/sales/types";
import { PAYMENT_REF_TYPES, type Payment, type PaymentInstrument, type PaymentRefType } from "@/pages/payments/types";

/** Money coming in from a customer has no account of ours to leave, so it names only where it landed. */
const INCOMING_REF_TYPES: readonly PaymentRefType[] = ["SALE", "BIRD_SALE"];

const REF_NOUN: Record<PaymentRefType, string> = {
  SALE: "Sale",
  BIRD_SALE: "Bird sale",
  PURCHASE: "Purchase",
  EXPENSE: "Expense",
};

const paymentSchema = z.object({
  ref_type: z.enum(PAYMENT_REF_TYPES, "Select what this pays"),
  ref_id: z.string().min(1, "Select a record to pay"),
  amount: z.coerce.number().positive("Enter an amount above 0"),
  payment_date: z.string().min(1, "Payment date is required"),
  // One of the farm's accounts, on the side the money moved: where it landed (money in) or where it
  // left from (money out). The other party is whoever the record names -- never an account here.
  account_id: z.string().min(1, "Select the farm account"),
  transaction_ref: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormValues = z.output<typeof paymentSchema>;

function blankPayment(defaults?: { ref_type?: PaymentRefType; ref_id?: string }): PaymentFormInput {
  const ref_type = (defaults?.ref_type ?? undefined) as unknown as PaymentFormInput["ref_type"];
  return {
    ref_type,
    ref_id: defaults?.ref_id ?? "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    account_id: "",
    transaction_ref: "",
    note: "",
  };
}

// Every ref type a payment can target has a different shape for label and amounts -- this is the one place
// that has to know all of them. paid/due already have every payment netted off (useOutstanding).
type RefOption = { id: string; label: string; detail: string; total: number; paid: number; due: number };

function useRefOptions(refType: PaymentRefType | undefined, keepRefId?: string): { options: RefOption[]; loading: boolean } {
  const { trueAmounts: trueSale, isLoading: l1 } = useOutstanding("SALE");
  const { trueAmounts: trueBirdSale, isLoading: l2 } = useOutstanding("BIRD_SALE");
  const { trueAmounts: truePurchase, isLoading: l3 } = useOutstanding("PURCHASE");
  const { trueAmounts: trueExpense, isLoading: l4 } = useOutstanding("EXPENSE");
  const { data: purchases, isLoading: l5 } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"], {
    enabled: refType === "PURCHASE",
  });
  const { data: sales, isLoading: l6 } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"], {
    enabled: refType === "SALE",
  });
  const { data: birdSales, isLoading: l7 } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", ["bird-sales"], {
    enabled: refType === "BIRD_SALE",
  });
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"], {
    enabled: refType === "BIRD_SALE",
  });
  const { data: expenses, isLoading: l8 } = useGetData<Paginated<Expense>>("/expenses?limit=100", ["expenses"], {
    enabled: refType === "EXPENSE",
  });
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"], {
    enabled: refType === "SALE" || refType === "BIRD_SALE",
  });
  const customer = (id: string | null) =>
    customers?.results.find((c) => c.id === id)?.profile.name ?? "Walk-in buyer";
  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8;

  const option = (
    id: string,
    label: string,
    detail: string,
    amounts: { paid: string; due: string },
  ): RefOption => {
    const paid = parseFloat(amounts.paid);
    const due = parseFloat(amounts.due);
    return { id, label, detail, total: paid + due, paid, due };
  };
  // Only records with something left to pay -- plus the one the dialog was opened for, so a fully paid
  // record still shows its state instead of vanishing.
  const payable = (o: RefOption) => o.due > 0 || o.id === keepRefId;

  let options: RefOption[] = [];
  if (refType === "PURCHASE") {
    options = (purchases?.results ?? []).map((p) =>
      option(
        p.id,
        `${p.invoice_no ?? "No invoice"} · ${formatDate(p.purchase_date)}`,
        `${p.items.length} line${p.items.length === 1 ? "" : "s"}`,
        truePurchase(p.id, p.paid_amount, p.due_amount),
      ),
    );
  } else if (refType === "SALE") {
    options = (sales?.results ?? []).map((s) =>
      option(
        s.id,
        `${customer(s.customer_id)} · ${formatDate(s.sale_date)}`,
        `${s.items.length} line${s.items.length === 1 ? "" : "s"}`,
        trueSale(s.id, s.paid_amount, s.due_amount),
      ),
    );
  } else if (refType === "BIRD_SALE") {
    options = (birdSales?.results ?? []).map((s) =>
      option(
        s.id,
        `${customer(s.customer_id)} · ${formatDate(s.sale_date)}`,
        `${batches?.results.find((b) => b.id === s.batch_id)?.batch_code ?? "Bird sale"}, ${s.birds_count} birds`,
        trueBirdSale(s.id, s.paid_amount, s.due_amount),
      ),
    );
  } else if (refType === "EXPENSE") {
    // An expense has no paid/due snapshot of its own: all of it is owed until paid.
    options = (expenses?.results ?? []).map((e) =>
      option(
        e.id,
        `${humanizeEnum(e.category)} · ${formatDate(e.date)}`,
        e.remarks ?? humanizeEnum(e.cost_type),
        trueExpense(e.id, "0", e.amount),
      ),
    );
  }
  return { options: options.filter(payable), loading };
}

type PaymentCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opened from a record's own row or page: the payment is for that record and it can't be changed. */
  defaultRefType?: PaymentRefType;
  defaultRefId?: string;
};

export function PaymentCreateDialog({ open, onOpenChange, defaultRefType, defaultRefId }: PaymentCreateDialogProps) {
  const locked = !!defaultRefType && !!defaultRefId;
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: blankPayment({ ref_type: defaultRefType, ref_id: defaultRefId }),
  });

  useEffect(() => {
    if (open) reset(blankPayment({ ref_type: defaultRefType, ref_id: defaultRefId }));
  }, [open, reset, defaultRefType, defaultRefId]);

  const refType = useWatch({ control, name: "ref_type" }) as PaymentRefType | undefined;
  const refId = useWatch({ control, name: "ref_id" });
  const amount = Number(useWatch({ control, name: "amount" })) || 0;
  const incoming = !!refType && INCOMING_REF_TYPES.includes(refType);
  const { options: refOptions, loading: refsLoading } = useRefOptions(refType, defaultRefId);
  const selected = refOptions.find((r) => r.id === refId);
  const fullyPaid = !!selected && selected.due <= 0;
  const dueAfter = selected ? Math.max(0, selected.due - amount) : 0;
  const overpay = !!selected && amount > selected.due + 0.005;

  const { data: history } = useGetData<Paginated<Payment>>(
    `/payments?ref_type=${refType}&ref_id=${refId}&limit=100`,
    ["payments", "history", refType, refId],
    { enabled: open && !!refType && !!refId },
  );
  const { data: accounts } = useGetData<Paginated<PaymentInstrument>>("/payment-instruments?limit=100", [
    "payment-instruments",
    "all",
  ]);
  const accountName = (p: Payment) =>
    accounts?.results.find((a) => a.id === (p.to_instrument_id ?? p.from_instrument_id))?.label ?? "—";

  const queryClient = useQueryClient();
  const createPayment = usePostData<Payment, Record<string, unknown>>("/payments", ["payments"]);

  const onSubmit = (values: PaymentFormValues) => {
    if (selected && values.amount > selected.due + 0.005) {
      setError("amount", { message: `Only ${formatMoney(selected.due)} is due` });
      return;
    }
    const { account_id, ...rest } = values;
    const payload = {
      ...rest,
      ...(INCOMING_REF_TYPES.includes(values.ref_type)
        ? { to_instrument_id: account_id }
        : { from_instrument_id: account_id }),
      transaction_ref: values.transaction_ref || undefined,
      note: values.note || undefined,
    };
    createPayment.mutate(payload, {
      onSuccess: () => {
        // A payment changes what the record still owes, the summaries and KPI tiles that read it, and the
        // account balance it moved.
        for (const key of ["sales", "bird-sales", "purchases", "expenses", "analytics", "payment-instruments"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        const left = selected ? selected.due - values.amount : 0;
        toast.success(
          left <= 0.005
            ? `${formatMoney(values.amount)} recorded -- fully paid`
            : `${formatMoney(values.amount)} recorded -- ${formatMoney(left)} still due`,
        );
        onOpenChange(false);
      },
      onError: (error) => {
        const message =
          error.fieldError("amount") ?? error.fieldError("from_instrument_id") ?? error.fieldError("to_instrument_id");
        toast.error(message ?? error.message);
      },
    });
  };

  const status = selected ? paymentStatus(String(selected.paid), String(selected.due)) : null;
  const payments = history?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{refType && locked ? `Record payment for this ${REF_NOUN[refType].toLowerCase()}` : "Record payment"}</DialogTitle>
          <DialogDescription>
            {incoming ? "Money received from the buyer." : refType ? "Money paid out by the farm." : "Choose what this payment is for."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          {/* Opened from the Payments page: pick what is being paid. From a record: it's fixed. */}
          {!locked && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ref_type">Pays for</Label>
                <Controller
                  control={control}
                  name="ref_type"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setValue("ref_id", "");
                      }}
                    >
                      <SelectTrigger id="ref_type" className="w-full" aria-invalid={!!errors.ref_type}>
                        <SelectValue>{(v: PaymentRefType) => (v ? REF_NOUN[v] : "Select type")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_REF_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {REF_NOUN[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.ref_type && <p className="text-xs text-destructive">{errors.ref_type.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ref_id">Record</Label>
                <Controller
                  control={control}
                  name="ref_id"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!refType}>
                      <SelectTrigger id="ref_id" className="w-full" aria-invalid={!!errors.ref_id}>
                        <SelectValue>
                          {(v: string) =>
                            refOptions.find((r) => r.id === v)?.label ??
                            (refType && !refsLoading && refOptions.length === 0 ? "Nothing left to pay" : "Select record")
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {refOptions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label} — due {formatMoney(r.due)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.ref_id && <p className="text-xs text-destructive">{errors.ref_id.message}</p>}
              </div>
            </div>
          )}

          {/* What is being paid, and where it stands */}
          {refId && !selected && refsLoading && <Skeleton className="h-28 w-full" />}
          {selected && status && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{selected.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{selected.detail}</div>
                </div>
                <StatusBadge tone={status.tone} label={status.label} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm tabular-nums">
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="font-medium">{formatMoney(selected.total)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Paid so far</dt>
                  <dd className="font-medium">{formatMoney(selected.paid)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due now</dt>
                  <dd className={cn("text-lg font-semibold leading-tight", fullyPaid && "text-success")}>
                    {formatMoney(selected.due)}
                  </dd>
                </div>
              </dl>
              {selected.total > 0 && (
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Share paid"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((selected.paid / selected.total) * 100)}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (selected.paid / selected.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {selected && payments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Payments so far</span>
              <ul className="divide-y rounded-lg border text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="tabular-nums">{formatDate(p.payment_date)}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {accountName(p)}
                        {p.transaction_ref ? `, ref ${p.transaction_ref}` : ""}
                        {p.note ? `, ${p.note}` : ""}
                      </div>
                    </div>
                    <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fullyPaid ? (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              This {refType ? REF_NOUN[refType].toLowerCase() : "record"} is fully paid. Nothing is left to record.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">Amount</Label>
                    {selected && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setValue("amount", String(selected.due), { shouldValidate: true })}
                      >
                        Pay full due
                      </button>
                    )}
                  </div>
                  <NumericInput
                    id="amount"
                    allowDecimal
                    decimalPlaces={2}
                    {...register("amount")}
                    aria-invalid={!!errors.amount || overpay}
                  />
                  {errors.amount ? (
                    <p className="text-xs text-destructive">{errors.amount.message}</p>
                  ) : overpay ? (
                    <p className="text-xs text-destructive">Only {formatMoney(selected!.due)} is due</p>
                  ) : selected && amount > 0 ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {dueAfter <= 0.005 ? "This settles it in full" : `Still due after this: ${formatMoney(dueAfter)}`}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payment_date">Date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    {...register("payment_date")}
                    aria-invalid={!!errors.payment_date}
                  />
                  {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="account_id">{incoming ? "Received into" : "Paid from"}</Label>
                  <Controller
                    control={control}
                    name="account_id"
                    render={({ field }) => (
                      <FarmAccountSelect
                        id="account_id"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        invalid={!!errors.account_id}
                      />
                    )}
                  />
                  {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="transaction_ref">Transaction ref (optional)</Label>
                  <Input id="transaction_ref" placeholder="Cheque no., bKash TrxID…" {...register("transaction_ref")} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" {...register("note")} />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {fullyPaid ? "Close" : "Cancel"}
            </Button>
            {!fullyPaid && (
              <Button type="submit" disabled={isSubmitting || overpay || (!!refId && !selected)}>
                {selected && amount > 0 ? `Record ${formatMoney(amount)}` : "Record payment"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

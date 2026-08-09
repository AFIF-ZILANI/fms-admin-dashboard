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
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Purchase } from "@/pages/purchases/types";
import type { Sale, BirdSale } from "@/pages/sales/types";
import {
  PAYMENT_DIRECTIONS,
  PAYMENT_REF_TYPES,
  type Payment,
  type PaymentInstrument,
  type PaymentRefType,
} from "@/pages/payments/types";

const paymentSchema = z.object({
  ref_type: z.enum(PAYMENT_REF_TYPES, "Select what this pays"),
  ref_id: z.string().min(1, "Select a record to pay"),
  direction: z.enum(PAYMENT_DIRECTIONS, "Select a direction"),
  amount: z.coerce.number().positive("Must be positive"),
  payment_date: z.string().min(1, "Payment date is required"),
  from_instrument_id: z.string().min(1, "Select the paying instrument"),
  to_instrument_id: z.string().optional(),
  transaction_ref: z.string().trim().optional(),
  handled_by_id: z.string().optional(),
  note: z.string().trim().optional(),
});

type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentFormValues = z.output<typeof paymentSchema>;

function blankPayment(): PaymentFormInput {
  return {
    ref_type: undefined as unknown as PaymentFormInput["ref_type"],
    ref_id: "",
    direction: undefined as unknown as PaymentFormInput["direction"],
    amount: undefined,
    payment_date: new Date().toISOString().slice(0, 10),
    from_instrument_id: "",
    to_instrument_id: "",
    transaction_ref: "",
    handled_by_id: "",
    note: "",
  };
}

// Every ref type a payment can target has a different shape for label + due
// amount — this is the one place that has to know all three.
type RefOption = { id: string; label: string; due: number };

function useRefOptions(refType: PaymentRefType | undefined): RefOption[] {
  const { data: purchases } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"], {
    enabled: refType === "PURCHASE",
  });
  const { data: sales } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"], {
    enabled: refType === "SALE",
  });
  const { data: birdSales } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", ["bird-sales"], {
    enabled: refType === "BIRD_SALE",
  });
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"], {
    enabled: refType === "BIRD_SALE",
  });

  if (refType === "PURCHASE") {
    return (purchases?.results ?? [])
      .filter((p) => parseFloat(p.due_amount) > 0)
      .map((p) => ({
        id: p.id,
        label: `${p.invoice_no ?? "No invoice"} · ${new Date(p.purchase_date).toLocaleDateString()}`,
        due: parseFloat(p.due_amount),
      }));
  }
  if (refType === "SALE") {
    return (sales?.results ?? [])
      .filter((s) => parseFloat(s.due_amount) > 0)
      .map((s) => ({
        id: s.id,
        label: `Sale · ${new Date(s.sale_date).toLocaleDateString()}`,
        due: parseFloat(s.due_amount),
      }));
  }
  if (refType === "BIRD_SALE") {
    return (birdSales?.results ?? [])
      .filter((b) => parseFloat(b.due_amount) > 0)
      .map((b) => ({
        id: b.id,
        label: `${batches?.results.find((batch) => batch.id === b.batch_id)?.batch_code ?? "Bird sale"} · ${new Date(b.sale_date).toLocaleDateString()}`,
        due: parseFloat(b.due_amount),
      }));
  }
  return [];
}

type PaymentCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function PaymentCreateDialog({ open, onOpenChange }: PaymentCreateDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: blankPayment(),
  });

  useEffect(() => {
    if (open) reset(blankPayment());
  }, [open, reset]);

  const refType = useWatch({ control, name: "ref_type" });
  const refId = useWatch({ control, name: "ref_id" });
  const refOptions = useRefOptions(refType);
  const selectedRef = refOptions.find((r) => r.id === refId);

  const { data: totalPaid } = useGetData<{ total_paid: string }>(
    `/payments/total-paid?ref_type=${refType}&ref_id=${refId}`,
    ["payments", "total-paid", refType, refId],
    { enabled: !!refType && !!refId }
  );
  const remainingDue = selectedRef ? selectedRef.due - parseFloat(totalPaid?.total_paid ?? "0") : undefined;

  const { data: instruments } = useGetData<Paginated<PaymentInstrument>>(
    "/payment-instruments?limit=100&is_active=true",
    ["payment-instruments"]
  );

  const createPayment = usePostData<Payment, PaymentFormValues>("/payments", ["payments"]);

  const instrumentLabel = (id: string) => {
    const instrument = instruments?.results.find((i) => i.id === id);
    return instrument ? `${instrument.label} (${humanizeEnum(instrument.type)})` : "";
  };

  const onSubmit = (values: PaymentFormValues) => {
    const payload = {
      ...values,
      to_instrument_id: values.to_instrument_id || undefined,
      transaction_ref: values.transaction_ref || undefined,
      handled_by_id: values.handled_by_id || undefined,
      note: values.note || undefined,
    };
    createPayment.mutate(payload, {
      onSuccess: () => {
        toast.success("Payment recorded");
        onOpenChange(false);
      },
      onError: (error) => {
        const message = error.fieldError("amount") ?? error.fieldError("from_instrument_id");
        toast.error(message ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Payments don't edit the original due amount — outstanding balance is the record's due minus everything
            paid against it here.
          </DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
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
                      setValue("direction", v === "PURCHASE" ? "OUTGOING" : "INCOMING");
                    }}
                  >
                    <SelectTrigger id="ref_type" className="w-full" aria-invalid={!!errors.ref_type}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select type")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_REF_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {humanizeEnum(t)}
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
                        {(v: string) => refOptions.find((r) => r.id === v)?.label ?? "Select record"}
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

          {selectedRef && (
            <p className="text-xs text-muted-foreground">
              Remaining due: <span className="font-medium tabular-nums">{formatMoney(remainingDue ?? selectedRef.due)}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="direction">Direction</Label>
              <Controller
                control={control}
                name="direction"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="direction" className="w-full" aria-invalid={!!errors.direction}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_DIRECTIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {humanizeEnum(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.direction && <p className="text-xs text-destructive">{errors.direction.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_date">Date</Label>
              <Input
                id="payment_date"
                type="date"
                {...register("payment_date")}
                aria-invalid={!!errors.payment_date}
              />
              {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_instrument_id">From instrument</Label>
              <Controller
                control={control}
                name="from_instrument_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="from_instrument_id" className="w-full" aria-invalid={!!errors.from_instrument_id}>
                      <SelectValue>{(v: string) => instrumentLabel(v) || "Select instrument"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(instruments?.results ?? []).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label} ({humanizeEnum(i.type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.from_instrument_id && (
                <p className="text-xs text-destructive">{errors.from_instrument_id.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_instrument_id">To instrument (optional)</Label>
              <Controller
                control={control}
                name="to_instrument_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="to_instrument_id" className="w-full">
                      <SelectValue>{(v: string) => instrumentLabel(v) || "None"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(instruments?.results ?? []).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label} ({humanizeEnum(i.type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transaction_ref">Transaction ref (optional)</Label>
              <Input id="transaction_ref" {...register("transaction_ref")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handled_by_id">Handled by (optional)</Label>
              <Controller
                control={control}
                name="handled_by_id"
                render={({ field }) => (
                  <ActorSelect id="handled_by_id" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

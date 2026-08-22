import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowLeft, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumericInput } from "@/components/utils/NumaricInput";
import { LAST_ADMIN_KEY } from "@/components/shared/actor-select";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Item } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import type { Supplier } from "@/pages/suppliers/types";
import type { PaymentInstrument } from "@/pages/payments/types";
import type { Purchase } from "@/pages/purchases/types";
import { BindCodesPrompt } from "@/pages/purchases/bind-codes-prompt";

const CODED_CATEGORIES = ["MEDICINE", "VACCINE", "EQUIPMENT"];

const lineSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Must be positive"),
  unit: z.string().min(1, "Select a unit"),
  unit_price: z.coerce.number().positive("Must be positive"),
  mfg_date: z.string().optional(),
  expiration_date: z.string().optional(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().optional(),
  invoice_no: z.string().trim().optional(),
  purchase_date: z.string().min(1, "Purchase date is required"),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type PurchaseFormInput = z.input<typeof purchaseSchema>;
type PurchaseFormValues = z.output<typeof purchaseSchema>;

function blankLine(): PurchaseFormInput["items"][number] {
  return {
    item_id: "",
    quantity: undefined,
    unit: undefined as unknown as PurchaseFormInput["items"][number]["unit"],
    unit_price: undefined,
    mfg_date: "",
    expiration_date: "",
  };
}

type Admin = { id: string; profile: { id: string; name: string } };

type PendingPayment = {
  enabled: boolean;
  amount: string;
  from_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
  note: string;
};

function blankPayment(purchaseDate: string): PendingPayment {
  return { enabled: false, amount: "", from_instrument_id: "", payment_date: purchaseDate, transaction_ref: "", note: "" };
}

export function PurchaseCreatePage() {
  usePageTitle("New purchase");
  const navigate = useNavigate();
  const [bindPromptPurchase, setBindPromptPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<PendingPayment>(() => blankPayment(new Date().toISOString().slice(0, 10)));
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [detailsIndex, setDetailsIndex] = useState<number | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplier_id: "",
      invoice_no: "",
      purchase_date: new Date().toISOString().slice(0, 10),
      items: [blankLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: instruments } = useGetData<Paginated<PaymentInstrument>>(
    "/payment-instruments?limit=100&is_active=true",
    ["payment-instruments"]
  );

  const createPurchase = usePostData<Purchase, PurchaseFormValues & { recorded_by_id: string; paid_amount: number }>(
    "/purchases",
    ["purchases"]
  );
  const createPayment = usePostData<unknown, Record<string, unknown>>("/payments", ["payments"]);

  const itemOptions = items?.results ?? [];
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  /** A line's allowed units are its item's base unit plus that item's ItemUnit conversions —
   * never the full global unit list, so a purchase can't be entered in a unit nothing converts from. */
  const allowedUnitsFor = (itemId: string): { code: string; label: string }[] => {
    const item = itemOptions.find((i) => i.id === itemId);
    if (!item) return [];
    const codes = [item.unit, ...(item.itemUnits ?? []).map((u) => u.unit)];
    return codes.map((code) => ({ code, label: unitLabel(code) }));
  };

  const totalPreview = (watchedItems ?? []).reduce((sum, line) => {
    const qty = Number(line?.quantity) || 0;
    const price = Number(line?.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const admin = admins?.results ?? [];
  const resolveRecordedBy = (): string | null => {
    const stored = localStorage.getItem(LAST_ADMIN_KEY);
    if (stored && admin.some((a) => a.profile.id === stored)) return stored;
    const fallback = admin[0]?.profile.id;
    if (fallback) localStorage.setItem(LAST_ADMIN_KEY, fallback);
    return fallback ?? null;
  };

  const onSubmit = (values: PurchaseFormValues) => {
    const recorded_by_id = resolveRecordedBy();
    if (!recorded_by_id) {
      toast.error("No admins exist yet — add one before recording a purchase.");
      return;
    }
    setPaymentError(null);
    if (payment.enabled) {
      const amount = Number(payment.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPaymentError("Enter a valid payment amount.");
        return;
      }
      if (!payment.from_instrument_id) {
        setPaymentError("Select which instrument this payment is from.");
        return;
      }
    }

    const payload = {
      ...values,
      supplier_id: values.supplier_id || undefined,
      invoice_no: values.invoice_no || undefined,
      recorded_by_id,
      paid_amount: 0,
      items: values.items.map((line) => ({
        ...line,
        mfg_date: line.mfg_date || undefined,
        expiration_date: line.expiration_date || undefined,
      })),
    };

    createPurchase.mutate(payload, {
      onSuccess: (purchase) => {
        toast.success("Purchase recorded");
        const afterPurchase = () => {
          const hasCodedItems = purchase.items.some((line) => CODED_CATEGORIES.includes(line.item.category));
          if (hasCodedItems) setBindPromptPurchase(purchase);
          else navigate(`/purchases/${purchase.id}`);
        };

        if (!payment.enabled) {
          afterPurchase();
          return;
        }

        createPayment.mutate(
          {
            ref_type: "PURCHASE",
            ref_id: purchase.id,
            direction: "OUTGOING",
            amount: Number(payment.amount),
            payment_date: payment.payment_date,
            from_instrument_id: payment.from_instrument_id,
            transaction_ref: payment.transaction_ref || undefined,
            handled_by_id: recorded_by_id,
            note: payment.note || undefined,
          },
          {
            onSuccess: () => {
              toast.success("Payment recorded");
              afterPurchase();
            },
            onError: (error) => {
              toast.warning(`Purchase saved, but the payment failed: ${error.message}`);
              afterPurchase();
            },
          }
        );
      },
      onError: (error) => {
        toast.error(error.fieldError("purchase_date") ?? error.message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/purchases")}>
        <ArrowLeft />
        Back to purchases
      </Button>

      {admin.length === 0 && (
        <p className="text-sm text-destructive">
          No admins yet — add one on the Admins page before recording a purchase.
        </p>
      )}

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier_id">Supplier (optional)</Label>
              <Controller
                control={control}
                name="supplier_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="supplier_id" className="w-full">
                      <SelectValue>
                        {(v: string) => suppliers?.results.find((s) => s.id === v)?.profile.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers?.results ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.profile.name}
                          {s.company ? ` (${s.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice_no">Invoice number (optional)</Label>
              <Input id="invoice_no" {...register("invoice_no")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase_date">Purchase date</Label>
              <Input
                id="purchase_date"
                type="date"
                {...register("purchase_date")}
                aria-invalid={!!errors.purchase_date}
              />
              {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
              <Plus />
              Add line
            </Button>
          </CardHeader>
          <CardContent>
            {errors.items?.root && <p className="mb-2 text-xs text-destructive">{errors.items.root.message}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Item</TableHead>
                  <TableHead className="w-24">Quantity</TableHead>
                  <TableHead className="w-28">Unit</TableHead>
                  <TableHead className="w-28">Unit price</TableHead>
                  <TableHead className="w-24 text-right">Total</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const lineItemId = watchedItems?.[index]?.item_id;
                  const lineUnits = lineItemId ? allowedUnitsFor(lineItemId) : [];
                  const lineErrors = errors.items?.[index];
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`items.${index}.item_id`}
                          render={({ field: f }) => (
                            <Select
                              value={f.value ?? ""}
                              onValueChange={(v) => {
                                f.onChange(v);
                                // Item changed — the previously selected unit may no longer be valid for it.
                                setValue(`items.${index}.unit`, undefined as unknown as string);
                              }}
                            >
                              <SelectTrigger className="w-full" aria-invalid={!!lineErrors?.item_id}>
                                <SelectValue>
                                  {(v: string) => itemOptions.find((i) => i.id === v)?.name ?? "Select item"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {itemOptions.map((i) => (
                                  <SelectItem key={i.id} value={i.id}>
                                    {i.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          allowDecimal
                          decimalPlaces={3}
                          aria-invalid={!!lineErrors?.quantity}
                          {...register(`items.${index}.quantity`, {
                            setValueAs: (v) => (v === "" ? undefined : Number(v)),
                          })}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`items.${index}.unit`}
                          render={({ field: f }) => (
                            <Select value={f.value ?? ""} onValueChange={f.onChange} disabled={!lineItemId}>
                              <SelectTrigger className="w-full" aria-invalid={!!lineErrors?.unit}>
                                <SelectValue>
                                  {(v: string) => (v ? unitLabel(v) : "Unit")}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {lineUnits.map((u) => (
                                  <SelectItem key={u.code} value={u.code}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <NumericInput
                          allowDecimal
                          decimalPlaces={2}
                          aria-invalid={!!lineErrors?.unit_price}
                          {...register(`items.${index}.unit_price`, {
                            setValueAs: (v) => (v === "" ? undefined : Number(v)),
                          })}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(
                          (Number(watchedItems?.[index]?.quantity) || 0) *
                            (Number(watchedItems?.[index]?.unit_price) || 0)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="More details"
                            onClick={() => setDetailsIndex(index)}
                          >
                            <MoreHorizontal />
                          </Button>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove line"
                              onClick={() => remove(index)}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-3 flex justify-end text-sm font-medium tabular-nums">
              Total: {formatMoney(totalPreview)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payment</CardTitle>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={payment.enabled}
                onChange={(e) => setPayment((p) => ({ ...p, enabled: e.target.checked }))}
              />
              Record a payment now
            </label>
          </CardHeader>
          {payment.enabled && (
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>From instrument</Label>
                <Select
                  value={payment.from_instrument_id}
                  onValueChange={(v) => setPayment((p) => ({ ...p, from_instrument_id: v ?? "" }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => {
                        const i = instruments?.results.find((inst) => inst.id === v);
                        return i ? `${i.label} (${humanizeEnum(i.type)})` : "Select instrument";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(instruments?.results ?? []).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.label} ({humanizeEnum(i.type)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={payment.payment_date}
                  onChange={(e) => setPayment((p) => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Transaction ref (optional)</Label>
                <Input
                  value={payment.transaction_ref}
                  onChange={(e) => setPayment((p) => ({ ...p, transaction_ref: e.target.value }))}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Note (optional)</Label>
                <Input value={payment.note} onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))} />
              </div>
              {paymentError && <p className="col-span-2 text-xs text-destructive">{paymentError}</p>}
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/purchases")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || admin.length === 0}>
            Record purchase
          </Button>
        </div>
      </form>

      <Dialog open={detailsIndex !== null} onOpenChange={(open) => !open && setDetailsIndex(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Line details</DialogTitle>
            <DialogDescription>Optional — only needed for perishables.</DialogDescription>
          </DialogHeader>
          {detailsIndex !== null && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Mfg date (optional)</Label>
                <Input type="date" {...register(`items.${detailsIndex}.mfg_date`)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Expiration date (optional)</Label>
                <Input type="date" {...register(`items.${detailsIndex}.expiration_date`)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setDetailsIndex(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BindCodesPrompt
        purchase={bindPromptPurchase}
        onDone={() => {
          if (bindPromptPurchase) navigate(`/purchases/${bindPromptPurchase.id}`);
          setBindPromptPurchase(null);
        }}
      />
    </div>
  );
}

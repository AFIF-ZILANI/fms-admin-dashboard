import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowLeft, MoreHorizontal, Plus, Trash2, Loader2 } from "lucide-react";
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
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import type { Supplier } from "@/pages/suppliers/types";
import type { PaymentInstrument } from "@/pages/payments/types";
import { DISCOUNT_TYPES, type DiscountType, type Purchase } from "@/pages/purchases/types";
import type { Batch } from "@/pages/batches/types";
import { BindCodesPrompt } from "@/pages/purchases/bind-codes-prompt";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";

const CODED_CATEGORIES = ["MEDICINE", "VACCINE", "EQUIPMENT"];

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = { FLAT: "Flat amount", PERCENT: "Percent" };

const lineSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Must be positive"),
  unit: z.string().min(1, "Select a unit"),
  unit_price: z.coerce.number().positive("Must be positive"),
  discount_type: z.enum(DISCOUNT_TYPES).optional(),
  discount_value: z.coerce.number().nonnegative().optional(),
  mfg_date: z.string().optional(),
  expiration_date: z.string().optional(),
  // Chicks only: the batch this delivery stocks. Its cost then lands in that batch's P&L, and the
  // line posts no warehouse stock (the birds are in the batch's house).
  batch_id: z.string().optional(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().optional(),
  warehouse_id: z.string().min(1, "Select a warehouse"),
  invoice_no: z.string().trim().optional(),
  purchase_date: z.string().min(1, "Purchase date is required"),
  discount_type: z.enum(DISCOUNT_TYPES).optional(),
  discount_value: z.coerce.number().nonnegative().optional(),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type PurchaseFormInput = z.input<typeof purchaseSchema>;
type PurchaseFormValues = z.output<typeof purchaseSchema>;
type LineInput = PurchaseFormInput["items"][number];

function blankLine(): LineInput {
  return {
    item_id: "",
    quantity: undefined,
    unit: undefined as unknown as LineInput["unit"],
    unit_price: undefined,
    discount_type: undefined,
    discount_value: undefined,
    mfg_date: "",
    expiration_date: "",
    batch_id: "",
  };
}

/** Amount a discount removes from `gross` -- FLAT is a currency amount, PERCENT is 0-100 of gross.
 * Mirrors PurchaseService.computeDiscount so the on-page preview matches what the server will charge. */
function discountAmount(gross: number, type: DiscountType | undefined, value: number | undefined): number {
  if (type === undefined || value === undefined || !Number.isFinite(value)) return 0;
  return type === "PERCENT" ? gross * (value / 100) : value;
}

function lineGross(line?: { quantity?: unknown; unit_price?: unknown }): number {
  return (Number(line?.quantity) || 0) * (Number(line?.unit_price) || 0);
}

function lineNet(line?: {
  quantity?: unknown;
  unit_price?: unknown;
  discount_type?: DiscountType;
  discount_value?: unknown;
}): number {
  const gross = lineGross(line);
  const value = line?.discount_value === undefined ? undefined : Number(line.discount_value);
  return Math.max(0, gross - discountAmount(gross, line?.discount_type, value));
}

type Admin = { id: string; profile: { id: string; name: string } };

const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
};

type PendingPayment = {
  status: PaymentStatus;
  amount: string;
  from_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
  note: string;
};

function blankPayment(purchaseDate: string): PendingPayment {
  return {
    status: "UNPAID",
    amount: "",
    from_instrument_id: "",
    payment_date: purchaseDate,
    transaction_ref: "",
    note: "",
  };
}

/** Transport, labour, unloading paid for this delivery -- added to the stock's cost (landed cost),
 * split over the lines by value on the server. Never a separate batch/farm expense. */
type PendingCharge = {
  key: string;
  category: string;
  amount: string;
  remarks: string;
  /** paid on the spot from paid_from_instrument_id; otherwise owed */
  paid: boolean;
  paid_from_instrument_id: string;
};

function blankCharge(): PendingCharge {
  return { key: crypto.randomUUID(), category: "", amount: "", remarks: "", paid: true, paid_from_instrument_id: "" };
}

export function PurchaseCreatePage() {
  usePageTitle("New purchase");
  const navigate = useNavigate();
  const [bindPromptPurchase, setBindPromptPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<PendingPayment>(() => blankPayment(new Date().toISOString().slice(0, 10)));
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [charges, setCharges] = useState<PendingCharge[]>([]);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const setCharge = (key: string, patch: Partial<PendingCharge>) =>
    setCharges((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
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
      warehouse_id: "",
      invoice_no: "",
      purchase_date: new Date().toISOString().slice(0, 10),
      discount_type: undefined,
      discount_value: undefined,
      items: [blankLine()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });
  const globalDiscountType = useWatch({ control, name: "discount_type" });
  const globalDiscountValue = useWatch({ control, name: "discount_value" });

  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const { data: runningBatches } = useGetData<Paginated<Batch>>("/batches?status=RUNNING&limit=100", [
    "batches",
    "RUNNING",
  ]);
  const isChickItem = (itemId?: string) => items?.results.find((i) => i.id === itemId)?.category === "CHICKS";
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: instruments } = useGetData<Paginated<PaymentInstrument>>(
    "/payment-instruments?limit=100&is_active=true",
    ["payment-instruments"]
  );
  const { data: expenseCategories } = useGetData<Paginated<LookupRow>>(
    "/expense-categories?active=true&limit=100",
    ["expense-categories", "active"]
  );

  const createPurchase = usePostData<Purchase, Record<string, unknown>>("/purchases", ["purchases"]);

  const itemOptions = items?.results ?? [];
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  /** A line's allowed units are the item's own base unit (always purchasable -- see
   * item-form-page.tsx, it never gets its own ItemUnit row) plus whichever ItemUnit conversions
   * are flagged purchasable. Without the base unit, an item with no extra conversions configured
   * (the common case right after creation) would offer no unit at all. */
  const allowedUnitsFor = (itemId: string): { code: string; label: string }[] => {
    const item = itemOptions.find((i) => i.id === itemId);
    if (!item) return [];
    return [
      { code: item.unit, label: unitLabel(item.unit) },
      ...(item.itemUnits ?? [])
        .filter((u) => u.is_purchasable)
        .map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
    ];
  };

  // Subtotal = sum of each line's own net total (gross minus that line's discount) -- this is what
  // the global discount below is then applied against, same order of operations as the backend.
  const subtotalPreview = (watchedItems ?? []).reduce((sum, line) => sum + lineNet(line), 0);
  const globalDiscountAmount = discountAmount(
    subtotalPreview,
    globalDiscountType,
    globalDiscountValue === undefined ? undefined : Number(globalDiscountValue)
  );
  const netTotalPreview = Math.max(0, subtotalPreview - globalDiscountAmount);
  const hasAnyDiscount =
    globalDiscountType !== undefined || (watchedItems ?? []).some((line) => line?.discount_type !== undefined);

  const admin = admins?.results ?? [];
  /** The amount that will actually be posted as a Payment. "Paid in full" always tracks the live
   * net total rather than a stored number, so it can't go stale if a line or discount changes after picking it. */
  const paymentAmount = payment.status === "PAID" ? netTotalPreview : Number(payment.amount);
  const chargesTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const onSubmit = (values: PurchaseFormValues) => {
    for (const [i, line] of values.items.entries()) {
      if ((line.discount_type !== undefined) !== (line.discount_value !== undefined)) {
        toast.error(`Line ${i + 1}: pick a discount type and enter a value, or leave both blank.`);
        return;
      }
    }
    if ((values.discount_type !== undefined) !== (values.discount_value !== undefined)) {
      toast.error("Enter a discount type and value, or leave both blank.");
      return;
    }
    const chickLine = values.items.findIndex((line) => isChickItem(line.item_id) && !line.batch_id);
    if (chickLine !== -1) {
      toast.error(`Line ${chickLine + 1}: chicks belong to a batch — pick it under the line's details (⋯).`);
      setDetailsIndex(chickLine);
      return;
    }

    setPaymentError(null);
    if (payment.status !== "UNPAID") {
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        setPaymentError("Enter a valid payment amount.");
        return;
      }
      if (payment.status === "PARTIAL" && paymentAmount >= netTotalPreview) {
        setPaymentError("A partial payment must be less than the total — pick \"Paid in full\" instead.");
        return;
      }
      if (!payment.from_instrument_id) {
        setPaymentError("Select which instrument this payment is from.");
        return;
      }
    }

    setChargeError(null);
    for (const [i, c] of charges.entries()) {
      const amount = Number(c.amount);
      if (!c.category) return setChargeError(`Charge ${i + 1}: select a category.`);
      if (!Number.isFinite(amount) || amount <= 0) return setChargeError(`Charge ${i + 1}: enter a valid amount.`);
      if (c.paid && !c.paid_from_instrument_id)
        return setChargeError(`Charge ${i + 1}: select the account it was paid from.`);
    }

    // The payment travels with the purchase and is written in the same transaction, so a purchase
    // can't be saved with its payment silently missing.
    const paying = payment.status !== "UNPAID";
    const payload = {
      ...values,
      supplier_id: values.supplier_id || undefined,
      invoice_no: values.invoice_no || undefined,
      paid_amount: paying ? paymentAmount : 0,
      ...(paying && {
        paid_from_instrument_id: payment.from_instrument_id,
        payment_date: payment.payment_date || undefined,
        payment_transaction_ref: payment.transaction_ref.trim() || undefined,
        payment_note: payment.note.trim() || undefined,
      }),
      items: values.items.map((line) => ({
        ...line,
        mfg_date: line.mfg_date || undefined,
        expiration_date: line.expiration_date || undefined,
        batch_id: (isChickItem(line.item_id) && line.batch_id) || undefined,
      })),
      // Written in the purchase's own transaction -- a charge can't be lost the way a second request could.
      charges: charges.map((c) => ({
        category: c.category,
        amount: Number(c.amount),
        remarks: c.remarks.trim() || undefined,
        paid_amount: c.paid ? Number(c.amount) : 0,
        paid_from_instrument_id: c.paid ? c.paid_from_instrument_id : undefined,
      })),
    };

    return createPurchase.mutate(payload, {
      onSuccess: (purchase) => {
        toast.success(paying ? `Purchase recorded and ${formatMoney(paymentAmount)} paid` : "Purchase recorded");
        const hasCodedItems = purchase.items.some((line) => CODED_CATEGORIES.includes(line.item.category));
        if (hasCodedItems) setBindPromptPurchase(purchase);
        else navigate(`/purchases/${purchase.id}`);
      },
      onError: (error) => {
        // The field reason (e.g. a charge's missing account), not just "Validation failed".
        toast.error(error.fieldError("purchase_date") ?? Object.values(error.fields ?? {})[0] ?? error.message);
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
          <CardContent className="grid grid-cols-4 gap-4">
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
              <Label htmlFor="warehouse_id">Warehouse</Label>
              <Controller
                control={control}
                name="warehouse_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="warehouse_id" className="w-full" aria-invalid={!!errors.warehouse_id}>
                      <SelectValue>
                        {(v: string) => warehouses?.results.find((w) => w.id === v)?.name ?? "Select warehouse"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(warehouses?.results ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.warehouse_id && <p className="text-xs text-destructive">{errors.warehouse_id.message}</p>}
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
                        {formatMoney(lineNet(watchedItems?.[index]))}
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

            <div className="mt-3 flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Overall discount (optional)</Label>
                <Controller
                  control={control}
                  name="discount_type"
                  render={({ field: f }) => (
                    <Select value={f.value ?? ""} onValueChange={(v) => f.onChange(v || undefined)}>
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          {(v: DiscountType) => (v ? DISCOUNT_TYPE_LABELS[v] : "None")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {DISCOUNT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <NumericInput
                  allowDecimal
                  decimalPlaces={2}
                  disabled={globalDiscountType === undefined}
                  className="w-24"
                  {...register("discount_value", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                />
              </div>

              {hasAnyDiscount ? (
                <div className="text-sm tabular-nums">
                  <div className="text-muted-foreground">Subtotal: {formatMoney(subtotalPreview)}</div>
                  {globalDiscountAmount > 0 && (
                    <div className="text-muted-foreground">Discount: −{formatMoney(globalDiscountAmount)}</div>
                  )}
                  <div className="font-medium">Total: {formatMoney(netTotalPreview)}</div>
                </div>
              ) : (
                <div className="text-sm font-medium tabular-nums">Total: {formatMoney(netTotalPreview)}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Payment</CardTitle>
            <Select
              value={payment.status}
              onValueChange={(v) =>
                setPayment((p) => ({ ...p, status: (v as PaymentStatus) ?? "UNPAID" }))
              }
            >
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
          </CardHeader>
          {payment.status !== "UNPAID" && (
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Amount</Label>
                <NumericInput
                  allowDecimal
                  decimalPlaces={2}
                  disabled={payment.status === "PAID"}
                  value={payment.status === "PAID" ? String(netTotalPreview) : payment.amount}
                  onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                />
                {payment.status === "PARTIAL" && (
                  <p className="text-xs text-muted-foreground">
                    Due after this payment: {formatMoney(Math.max(0, netTotalPreview - paymentAmount))}
                  </p>
                )}
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Extra charges</CardTitle>
              <p className="text-xs text-muted-foreground">
                Transport, labour, unloading for this delivery — added to the items' cost, not a separate expense.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setCharges((l) => [...l, blankCharge()])}>
              <Plus />
              Add charge
            </Button>
          </CardHeader>
          {charges.length > 0 && (
            <CardContent className="flex flex-col gap-4">
              {charges.map((c) => (
                <div key={c.key} className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
                  <Select value={c.category} onValueChange={(v) => setCharge(c.key, { category: v ?? "" })}>
                    <SelectTrigger className="w-full" aria-label="Charge category">
                      <SelectValue>
                        {(v: string) =>
                          v
                            ? (expenseCategories?.results.find((e) => e.code === v)?.label ?? humanizeEnum(v))
                            : "Category"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(expenseCategories?.results ?? []).map((e) => (
                        <SelectItem key={e.code} value={e.code}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <NumericInput
                    allowDecimal
                    decimalPlaces={2}
                    placeholder="Amount"
                    aria-label="Charge amount"
                    value={c.amount}
                    onChange={(e) => setCharge(c.key, { amount: e.target.value })}
                  />
                  <Input
                    placeholder="Remarks (optional)"
                    aria-label="Charge remarks"
                    value={c.remarks}
                    onChange={(e) => setCharge(c.key, { remarks: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove charge"
                    onClick={() => setCharges((l) => l.filter((x) => x.key !== c.key))}
                  >
                    <Trash2 />
                  </Button>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={c.paid}
                      onChange={(e) => setCharge(c.key, { paid: e.target.checked })}
                    />
                    Paid on the spot
                  </label>
                  {c.paid && (
                    <div className="sm:col-span-2">
                      <FarmAccountSelect
                        value={c.paid_from_instrument_id}
                        onChange={(v) => setCharge(c.key, { paid_from_instrument_id: v })}
                      />
                    </div>
                  )}
                </div>
              ))}
              {chargesTotal > 0 && subtotalPreview > 0 && (
                <p className="text-sm text-muted-foreground">
                  Goods {formatMoney(subtotalPreview)} + charges {formatMoney(chargesTotal)} ={" "}
                  <span className="font-medium text-foreground">{formatMoney(subtotalPreview + chargesTotal)}</span> real
                  cost (+{((chargesTotal / subtotalPreview) * 100).toFixed(1)}% on each item)
                </p>
              )}
              {chargeError && <p className="text-xs text-destructive">{chargeError}</p>}
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/purchases")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || admin.length === 0}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Record purchase
          </Button>
        </div>
      </form>

      <Dialog open={detailsIndex !== null} onOpenChange={(open) => !open && setDetailsIndex(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Line details</DialogTitle>
            <DialogDescription>Discount, mfg/expiration for perishables, and the batch for chicks.</DialogDescription>
          </DialogHeader>
          {detailsIndex !== null && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Label className="w-20 shrink-0">Discount</Label>
                <Controller
                  control={control}
                  name={`items.${detailsIndex}.discount_type`}
                  render={({ field: f }) => (
                    <Select value={f.value ?? ""} onValueChange={(v) => f.onChange(v || undefined)}>
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          {(v: DiscountType) => (v ? DISCOUNT_TYPE_LABELS[v] : "None")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOUNT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {DISCOUNT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <NumericInput
                  allowDecimal
                  decimalPlaces={2}
                  disabled={watchedItems?.[detailsIndex]?.discount_type === undefined}
                  className="w-24"
                  {...register(`items.${detailsIndex}.discount_value`, {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
              </div>
              {isChickItem(watchedItems?.[detailsIndex]?.item_id) && (
                <div className="flex flex-col gap-1.5">
                  <Label>Batch</Label>
                  <Controller
                    control={control}
                    name={`items.${detailsIndex}.batch_id`}
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={(v) => f.onChange(v ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) => runningBatches?.results.find((b) => b.id === v)?.batch_code ?? "Select batch"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(runningBatches?.results ?? []).map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">Chicks are charged to this batch.</p>
                </div>
              )}
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

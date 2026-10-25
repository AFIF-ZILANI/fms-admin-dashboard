import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput, PositiveIntegerInput } from "@/components/utils/NumaricInput";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type ApiError, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { BIRD_BREEDS, type Batch } from "@/pages/batches/types";
import type { House } from "@/pages/houses/types";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { Supplier } from "@/pages/suppliers/types";
import type { Purchase } from "@/pages/purchases/types";

const batchSchema = z.object({
  batch_code: z.string().trim().min(1, "Batch code is required"),
  breed: z.enum(BIRD_BREEDS, "Select a breed"),
  starting_date: z.string().optional(),
  expected_selling_date: z.string().min(1, "Expected selling date is required"),
  initial_chick_count: z.coerce.number().int().positive("Must be a positive number"),
  init_chicks_avg_wt: z.coerce.number().positive("Must be a positive number"),
  house_id: z.string().min(1, "Select the initial house"),
});

// z.coerce fields split input/output types — same pattern as Houses.
type BatchFormInput = z.input<typeof batchSchema>;
type BatchFormValues = z.output<typeof batchSchema>;

const SELLING_DAYS_OUT = 60;

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parsed as local time, not UTC — "YYYY-MM-DD" via `new Date(string)` parses as UTC and can land on the wrong day.
function fromDateInput(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function addDays(dateInput: string, days: number): string {
  const d = fromDateInput(dateInput);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}

const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
};

/** The chick delivery that starts the batch: a normal Purchase whose one line carries the batch's id
 *  (batch-management-design.md §3), so its cost lands in the batch P&L. Later deliveries for the same
 *  batch are just more purchases from the Purchases page. */
type ChickPurchase = {
  enabled: boolean;
  supplier_id: string;
  invoice_no: string;
  /** "" = same as the chicks placed; hatcheries often add a few free extras. */
  billed: string;
  unit_price: string;
  status: PaymentStatus;
  amount: string;
  from_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
};

const CHICK_ITEM_NAME = "Day-old chick";

export function BatchCreatePage() {
  usePageTitle("New batch");
  const navigate = useNavigate();
  const today = toDateInput(new Date());

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<BatchFormInput, unknown, BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batch_code: today,
      breed: undefined,
      starting_date: today,
      expected_selling_date: addDays(today, SELLING_DAYS_OUT),
      initial_chick_count: undefined,
      init_chicks_avg_wt: undefined,
      house_id: "",
    },
  });

  // batch_code and expected_selling_date follow starting_date until the user edits them directly.
  const startingDate = useWatch({ control, name: "starting_date" });
  useEffect(() => {
    if (!startingDate) return;
    if (!dirtyFields.batch_code) setValue("batch_code", startingDate);
    if (!dirtyFields.expected_selling_date) setValue("expected_selling_date", addDays(startingDate, SELLING_DAYS_OUT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingDate]);

  const [chicks, setChicks] = useState<ChickPurchase>({
    enabled: true,
    supplier_id: "",
    invoice_no: "",
    billed: "",
    unit_price: "",
    status: "UNPAID",
    amount: "",
    from_instrument_id: "",
    payment_date: today,
    transaction_ref: "",
  });
  const [chickError, setChickError] = useState<string | null>(null);
  const setChick = (patch: Partial<ChickPurchase>) => setChicks((c) => ({ ...c, ...patch }));

  const { data: houses } = useGetData<Paginated<House>>(
    "/houses?is_active=true&is_available=true&type=BROODER&limit=100",
    ["houses", "available", "brooder"],
  );
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: chickItems } = useGetData<Paginated<Item>>("/items?category=CHICKS&limit=100", ["items", "CHICKS"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);

  const createBatch = usePostData<Batch, BatchFormValues>("/batches", ["batches"]);
  const createItem = usePostData<Item, Record<string, unknown>>("/items", ["items"]);
  const createPurchase = usePostData<Purchase, Record<string, unknown>>("/purchases", ["purchases"]);

  const placed = Number(useWatch({ control, name: "initial_chick_count" })) || 0;
  const billed = chicks.billed === "" ? placed : Number(chicks.billed);
  const unitPrice = Number(chicks.unit_price);
  const total = Number.isFinite(billed * unitPrice) ? billed * unitPrice : 0;
  const paymentAmount = chicks.status === "PAID" ? total : Number(chicks.amount);
  const chickItem = chickItems?.results.find((i) => i.is_active) ?? null;

  /** What's wrong with the chick purchase/payment, checked before anything is saved so a bad payment
   *  can't leave a batch behind with its purchase missing. */
  function chickProblem(): string | null {
    if (!chicks.enabled) return null;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return "Enter the price per chick.";
    if (!Number.isInteger(billed) || billed <= 0) return "Enter how many chicks were billed.";
    if (!warehouses?.results.length) return "Add a warehouse first — every purchase is filed under one.";
    if (chicks.status !== "UNPAID") {
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return "Enter a valid payment amount.";
      if (chicks.status === "PARTIAL" && paymentAmount >= total)
        return 'A partial payment must be less than the total — pick "Paid in full" instead.';
      if (!chicks.from_instrument_id) return "Select which account the payment came from.";
    }
    return null;
  }

  const onSubmit = async (values: BatchFormValues) => {
    const problem = chickProblem();
    setChickError(problem);
    if (problem) return;

    let batch: Batch;
    try {
      batch = await createBatch.mutateAsync({ ...values, starting_date: values.starting_date || undefined });
    } catch (e) {
      const error = e as ApiError;
      let hadFieldError = false;
      for (const key of [
        "batch_code",
        "breed",
        "expected_selling_date",
        "initial_chick_count",
        "init_chicks_avg_wt",
        "house_id",
      ] as const) {
        const message = error.fieldError(key);
        if (message) {
          setError(key, { message });
          hadFieldError = true;
        }
      }
      if (!hadFieldError) toast.error(error.message);
      return;
    }

    if (chicks.enabled) {
      // ponytail: two requests, not one transaction -- the checks above catch the usual failures; if
      // the purchase still fails, the batch is kept and the message says where to add it.
      try {
        const item =
          chickItem ?? (await createItem.mutateAsync({ name: CHICK_ITEM_NAME, category: "CHICKS", unit: "PCS" }));
        const paying = chicks.status !== "UNPAID";
        await createPurchase.mutateAsync({
          supplier_id: chicks.supplier_id || undefined,
          // Chick lines post no warehouse stock; the purchase is just filed under the first warehouse.
          warehouse_id: warehouses!.results[0]!.id,
          invoice_no: chicks.invoice_no.trim() || undefined,
          purchase_date: values.starting_date || today,
          paid_amount: paying ? paymentAmount : 0,
          ...(paying && {
            paid_from_instrument_id: chicks.from_instrument_id,
            payment_date: chicks.payment_date || undefined,
            payment_transaction_ref: chicks.transaction_ref.trim() || undefined,
          }),
          items: [{ item_id: item.id, batch_id: batch.id, quantity: billed, unit: item.unit, unit_price: unitPrice }],
        });
      } catch (e) {
        toast.warning(
          `Batch created, but the chick purchase wasn't saved: ${(e as ApiError).message}. Add it from Purchases, choosing this batch.`,
        );
        navigate(`/batches/${batch.id}`);
        return;
      }
    }

    toast.success(chicks.enabled ? "Batch and chick purchase recorded" : "Batch created");
    navigate(`/batches/${batch.id}`);
  };

  const fieldError = (message?: string) => message && <p className="text-xs text-destructive">{message}</p>;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/batches")}>
        <ArrowLeft />
        Back to batches
      </Button>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch</CardTitle>
            <p className="text-xs text-muted-foreground">
              Creates the batch and places its chicks in a brooder house.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch_code">Batch code</Label>
              <Input id="batch_code" placeholder="e.g. B-2026-01" {...register("batch_code")} aria-invalid={!!errors.batch_code} />
              {fieldError(errors.batch_code?.message)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="breed">Breed</Label>
              <Controller
                control={control}
                name="breed"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="breed" className="w-full" aria-invalid={!!errors.breed}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select breed")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BIRD_BREEDS.map((breed) => (
                        <SelectItem key={breed} value={breed}>
                          {humanizeEnum(breed)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fieldError(errors.breed?.message)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="starting_date">Batch starts</Label>
              <Input id="starting_date" type="date" {...register("starting_date")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_selling_date">Expected selling date</Label>
              <Input
                id="expected_selling_date"
                type="date"
                {...register("expected_selling_date")}
                aria-invalid={!!errors.expected_selling_date}
              />
              {fieldError(errors.expected_selling_date?.message)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initial_chick_count">Chicks placed</Label>
              <PositiveIntegerInput
                id="initial_chick_count"
                placeholder="e.g. 1000"
                {...register("initial_chick_count", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                aria-invalid={!!errors.initial_chick_count}
              />
              {fieldError(errors.initial_chick_count?.message)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="init_chicks_avg_wt">Avg weight per chick (g)</Label>
              <NumericInput
                id="init_chicks_avg_wt"
                placeholder="e.g. 30.2"
                allowDecimal
                decimalPlaces={2}
                {...register("init_chicks_avg_wt", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                aria-invalid={!!errors.init_chicks_avg_wt}
              />
              {fieldError(errors.init_chicks_avg_wt?.message)}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="house_id">Brooder house</Label>
              <Controller
                control={control}
                name="house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="house_id" className="w-full" aria-invalid={!!errors.house_id}>
                      <SelectValue>
                        {(v: string) => houses?.results.find((h) => h.id === v)?.name ?? "Select house"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(houses?.results ?? []).map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          {house.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {fieldError(errors.house_id?.message)}
              {houses && houses.results.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No brooder houses available — all are occupied by a running batch.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Chick purchase</CardTitle>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chicks.enabled} onChange={(e) => setChick({ enabled: e.target.checked })} />
              Record the chick purchase
            </label>
          </CardHeader>
          {chicks.enabled ? (
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier">Supplier / hatchery</Label>
                <Select value={chicks.supplier_id} onValueChange={(v) => setChick({ supplier_id: v ?? "" })}>
                  <SelectTrigger id="supplier" className="w-full">
                    <SelectValue>
                      {(v: string) => suppliers?.results.find((s) => s.id === v)?.profile.name ?? "Select supplier"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers?.results ?? []).map((s) => (
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
                  placeholder={placed ? String(placed) : "Same as placed"}
                  value={chicks.billed}
                  onChange={(e) => setChick({ billed: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave empty if it's the same as the chicks placed.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">
                  {billed || 0} × {formatMoney(Number.isFinite(unitPrice) ? unitPrice : 0)}
                </span>
                <span className="font-medium tabular-nums">{formatMoney(total)}</span>
              </div>
              {!chickItem && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  A "{CHICK_ITEM_NAME}" item (Chicks, pcs) will be added to the catalog for this purchase.
                </p>
              )}
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-xs text-muted-foreground">
                The batch is created without a purchase. Record the chicks later from Purchases, choosing this batch.
              </p>
            </CardContent>
          )}
        </Card>

        {chicks.enabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Payment</CardTitle>
              <Select value={chicks.status} onValueChange={(v) => setChick({ status: (v as PaymentStatus) ?? "UNPAID" })}>
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
            {chicks.status === "UNPAID" ? (
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(total)} stays due to the supplier — pay it later from Payments.
                </p>
              </CardContent>
            ) : (
              <CardContent className="grid gap-4 sm:grid-cols-2">
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
                    <p className="text-xs text-muted-foreground">
                      Due after this payment: {formatMoney(Math.max(0, total - (paymentAmount || 0)))}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="from_instrument">Paid from</Label>
                  <FarmAccountSelect
                    id="from_instrument"
                    value={chicks.from_instrument_id}
                    onChange={(v) => setChick({ from_instrument_id: v })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Payment date</Label>
                  <Input type="date" value={chicks.payment_date} onChange={(e) => setChick({ payment_date: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Transaction ref (optional)</Label>
                  <Input value={chicks.transaction_ref} onChange={(e) => setChick({ transaction_ref: e.target.value })} />
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {chickError && <p className="text-sm text-destructive">{chickError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/batches")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "Saving…" : "Create batch"}
          </Button>
        </div>
      </form>
    </div>
  );
}

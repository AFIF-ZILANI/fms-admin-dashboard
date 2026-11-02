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
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type ApiError, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { BIRD_BREEDS, type Batch } from "@/pages/batches/types";
import type { House } from "@/pages/houses/types";
import { blankChickPurchase, chickProblem, chickTotals, useChickPurchase, type ChickPurchase } from "@/pages/batches/chick-purchase";
import { ChickPaymentFields, ChickPurchaseFields, PaymentStatusSelect } from "@/pages/batches/chick-purchase-fields";

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

  const [chicksEnabled, setChicksEnabled] = useState(true);
  const [chicks, setChicks] = useState<ChickPurchase>(() => blankChickPurchase(today));
  const [chickError, setChickError] = useState<string | null>(null);
  const setChick = (patch: Partial<ChickPurchase>) => setChicks((c) => ({ ...c, ...patch }));

  const { data: houses } = useGetData<Paginated<House>>(
    "/houses?is_active=true&is_available=true&type=BROODER&limit=100",
    ["houses", "available", "brooder"],
  );

  const createBatch = usePostData<Batch, BatchFormValues>("/batches", ["batches"]);
  const chickPurchase = useChickPurchase();

  const placed = Number(useWatch({ control, name: "initial_chick_count" })) || 0;
  const { total } = chickTotals(chicks, placed);

  const onSubmit = async (values: BatchFormValues) => {
    const problem = chicksEnabled ? chickProblem(chicks, placed, chickPurchase.hasWarehouse) : null;
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

    if (chicksEnabled) {
      // ponytail: two requests, not one transaction -- the checks above catch the usual failures; if
      // the purchase still fails, the batch is kept and the message says where to add it.
      try {
        await chickPurchase.record(batch.id, chicks, placed, values.starting_date || today);
      } catch (e) {
        toast.warning(
          `Batch created, but the chick purchase wasn't saved: ${(e as ApiError).message}. Add it with "Add chick delivery" on the batch page.`,
        );
        navigate(`/batches/${batch.id}`);
        return;
      }
    }

    toast.success(chicksEnabled ? "Batch and chick purchase recorded" : "Batch created");
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
              <input type="checkbox" checked={chicksEnabled} onChange={(e) => setChicksEnabled(e.target.checked)} />
              Record the chick purchase
            </label>
          </CardHeader>
          {chicksEnabled ? (
            <CardContent>
              <ChickPurchaseFields
                chicks={chicks}
                setChick={setChick}
                defaultBilled={placed}
                sameAsPlaced
                suppliers={chickPurchase.suppliers?.results ?? []}
                showNewItemNote={!chickPurchase.chickItem}
              />
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-xs text-muted-foreground">
                The batch is created without a purchase. Record the chicks later with "Add chick delivery" on the batch page.
              </p>
            </CardContent>
          )}
        </Card>

        {chicksEnabled && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Payment</CardTitle>
              <PaymentStatusSelect value={chicks.status} onChange={(status) => setChick({ status })} />
            </CardHeader>
            <CardContent>
              <ChickPaymentFields chicks={chicks} setChick={setChick} total={total} />
            </CardContent>
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

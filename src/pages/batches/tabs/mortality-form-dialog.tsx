import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Loader2, Minus, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { PositiveIntegerInput } from "@/components/utils/NumaricInput";
import { usePostData } from "@/lib/api";
import { cn, formatDate, humanizeEnum } from "@/lib/utils";
import { useDiseaseCases } from "@/pages/batches/disease-cases";
import { Chip, Section } from "@/pages/batches/form-parts";
import type { Batch, MortalityLog } from "@/pages/batches/types";

// Same as the server's mortality alert (server/src/lib/alert-rules.ts), so the form warns where the alert would fire.
const WARNING_RATE = 0.005;
const CRITICAL_RATE = 0.01;

const mortalitySchema = z.object({
  house_id: z.string().min(1, "Select a house"),
  count_died: z.coerce.number().int().positive("Must be a positive number"),
  cause_note: z.string().trim().optional(),
  disease_case_id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

/** Now as a datetime-local value ("YYYY-MM-DDTHH:MM") in the browser's zone. */
const nowLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

type MortalityFormInput = z.input<typeof mortalitySchema>;
type MortalityFormValues = z.output<typeof mortalitySchema>;

type MortalityFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function MortalityFormDialog({ open, onOpenChange, batch }: MortalityFormDialogProps) {
  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);
  // One house in use? Nothing to choose.
  const blank = (): MortalityFormInput => ({
    house_id: occupiedHouses.length === 1 ? (occupiedHouses[0]?.house_id ?? "") : "",
    count_died: "",
    cause_note: "",
    disease_case_id: "",
    date: nowLocal(),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MortalityFormInput, unknown, MortalityFormValues>({
    resolver: zodResolver(mortalitySchema),
    defaultValues: blank(),
  });

  // Dialog stays mounted between opens — without this, a second log would
  // start from whatever was left in the form after the previous submit.
  useEffect(() => {
    if (open) reset(blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset to the batch's houses as of this open
  }, [open, reset]);

  const [houseId, countRaw, caseId] = useWatch({ control, name: ["house_id", "count_died", "disease_case_id"] });
  const count = Number(countRaw) || 0;
  const live = occupiedHouses.find((b) => b.house_id === houseId)?.quantity ?? 0;
  const rate = live ? count / live : 0;
  const tooMany = !!houseId && count > live;

  const { data: casesData } = useDiseaseCases(batch.id);
  const openCases = (casesData?.results ?? []).filter(
    (c) => c.status === "ACTIVE" && c.houses.some((h) => h.id === houseId)
  );

  const queryClient = useQueryClient();
  const createMortalityLog = usePostData<MortalityLog, MortalityFormValues & { batch_id: string }>(
    "/mortality-logs",
    ["mortality-logs", batch.id]
  );

  const step = (by: number) => setValue("count_died", String(Math.max(count + by, 1)), { shouldValidate: true });

  const onSubmit = (values: MortalityFormValues) => {
    if (values.count_died > live) {
      setError("count_died", { message: `Only ${live.toLocaleString()} live birds in this house` });
      return;
    }
    // datetime-local has no zone; send the instant so the log keeps its HH:MM.
    const payload = {
      ...values,
      date: new Date(values.date).toISOString(),
      batch_id: batch.id,
      cause_note: values.cause_note || undefined,
      disease_case_id: values.disease_case_id || undefined,
    };
    return createMortalityLog.mutate(payload, {
      onSuccess: () => {
        // Mortality decrements the batch's house balances — the detail page's own
        // ["batches", id] query (and the list's ["batches", ...]) need to refetch too.
        void queryClient.invalidateQueries({ queryKey: ["batches"] });
        if (payload.disease_case_id) void queryClient.invalidateQueries({ queryKey: ["disease-cases"] });
        toast.success("Mortality logged");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["house_id", "count_died", "cause_note", "date"] as const) {
          const message = error.fieldError(key);
          if (message) {
            setError(key, { message });
            hadFieldError = true;
          }
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4">
          <DialogTitle>Log mortality</DialogTitle>
          <DialogDescription>{batch.batch_code}</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            <Section title="Where">
              <Controller
                control={control}
                name="house_id"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {occupiedHouses.map((b) => (
                      <Chip
                        key={b.house_id}
                        on={field.value === b.house_id}
                        onClick={() => {
                          field.onChange(b.house_id);
                          // The case list is per house; a case picked for another house no longer applies.
                          setValue("disease_case_id", "");
                        }}
                      >
                        {b.house.name}
                        <span className="tabular-nums opacity-70">{b.quantity.toLocaleString()} live</span>
                      </Chip>
                    ))}
                  </div>
                )}
              />
              {errors.house_id && <p className="text-xs text-destructive">{errors.house_id.message}</p>}
            </Section>

            <Section title="How many">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="One fewer" onClick={() => step(-1)}>
                  <Minus />
                </Button>
                <PositiveIntegerInput
                  id="count_died"
                  aria-label="Birds died"
                  placeholder="0"
                  className="h-10 w-28 text-center text-lg font-medium tabular-nums"
                  {...register("count_died")}
                  aria-invalid={!!errors.count_died || tooMany}
                />
                <Button type="button" variant="outline" size="icon" aria-label="One more" onClick={() => step(1)}>
                  <Plus />
                </Button>
                <span className="text-sm text-muted-foreground">birds died</span>
              </div>
              {errors.count_died ? (
                <p className="text-xs text-destructive">{errors.count_died.message}</p>
              ) : tooMany ? (
                <p className="text-xs text-destructive">Only {live.toLocaleString()} live birds in this house</p>
              ) : (
                count > 0 &&
                live > 0 && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-sm tabular-nums",
                      rate > CRITICAL_RATE ? "text-critical" : rate > WARNING_RATE ? "text-warning" : "text-muted-foreground"
                    )}
                  >
                    {rate > CRITICAL_RATE ? (
                      <AlertCircle className="size-4" />
                    ) : rate > WARNING_RATE ? (
                      <AlertTriangle className="size-4" />
                    ) : null}
                    {(rate * 100).toFixed(2)}% of this house · {(live - count).toLocaleString()} left
                    {rate > WARNING_RATE && " · high mortality"}
                  </p>
                )
              )}
            </Section>

            <Section title="Cause">
              {houseId && openCases.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Open disease in this house</Label>
                  <div className="flex flex-wrap gap-2">
                    <Chip on={!caseId} onClick={() => setValue("disease_case_id", "")}>
                      None
                    </Chip>
                    {openCases.map((c) => (
                      <Chip key={c.id} on={caseId === c.id} onClick={() => setValue("disease_case_id", c.id)}>
                        {c.disease.label}
                        <span className="opacity-70">
                          {humanizeEnum(c.severity)} · since {formatDate(c.noticed_on)}
                        </span>
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              <Input id="cause_note" placeholder="Note (optional): what you saw" {...register("cause_note")} />
            </Section>

            <Section title="When">
              <div className="flex items-center gap-2">
                <Input
                  id="date"
                  type="datetime-local"
                  className="w-56"
                  {...register("date")}
                  aria-label="Date and time"
                  aria-invalid={!!errors.date}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("date", nowLocal())}>
                  Now
                </Button>
              </div>
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </Section>
          </div>

          <DialogFooter className="m-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || tooMany}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {count > 0 ? `Log ${count.toLocaleString()} death${count === 1 ? "" : "s"}` : "Log mortality"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

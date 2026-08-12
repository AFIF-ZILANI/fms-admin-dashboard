import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { BIRD_BREEDS, type Batch } from "@/pages/batches/types";
import type { House } from "@/pages/houses/types";
import {
  NumericInput,
  PositiveIntegerInput,
} from "@/components/utils/NumaricInput";

const batchSchema = z.object({
  batch_code: z.string().trim().min(1, "Batch code is required"),
  breed: z.enum(BIRD_BREEDS, "Select a breed"),
  starting_date: z.string().optional(),
  expected_selling_date: z.string().min(1, "Expected selling date is required"),
  initial_chick_count: z.coerce
    .number()
    .int()
    .positive("Must be a positive number"),
  init_chicks_avg_wt: z.coerce.number().positive("Must be a positive number"),
  house_id: z.string().min(1, "Select the initial house"),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
});

// z.coerce fields (initial_chick_count, init_chicks_avg_wt) split input/output types — same pattern as Houses.
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

type BatchCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BatchCreateDialog({
  open,
  onOpenChange,
}: BatchCreateDialogProps) {
  const navigate = useNavigate();
  const today = toDateInput(new Date());
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
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
      recorded_by_id: "",
    },
  });

  // batch_code and expected_selling_date follow starting_date until the user edits them directly.
  const startingDate = watch("starting_date");
  useEffect(() => {
    if (!startingDate) return;
    if (!dirtyFields.batch_code) setValue("batch_code", startingDate);
    if (!dirtyFields.expected_selling_date)
      setValue(
        "expected_selling_date",
        addDays(startingDate, SELLING_DAYS_OUT),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingDate]);

  const { data: houses } = useGetData<Paginated<House>>(
    "/houses?is_active=true&is_available=true&type=BROODER&limit=100",
    ["houses", "available", "brooder"],
  );

  const createBatch = usePostData<Batch, BatchFormValues>("/batches", [
    "batches",
  ]);

  const onSubmit = (values: BatchFormValues) => {
    const payload = {
      ...values,
      starting_date: values.starting_date || undefined,
    };
    createBatch.mutate(payload, {
      onSuccess: (batch) => {
        toast.success("Batch created");
        onOpenChange(false);
        navigate(`/batches/${batch.id}`);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of [
          "batch_code",
          "breed",
          "expected_selling_date",
          "initial_chick_count",
          "init_chicks_avg_wt",
          "house_id",
          "recorded_by_id",
        ] as const) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create batch</DialogTitle>
          <DialogDescription>
            Places the initial chicks into a house — creates the batch and its
            first house allocation together.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch_code">Batch code</Label>
              <Input
                id="batch_code"
                placeholder="e.g. B-2026-01"
                {...register("batch_code")}
                aria-invalid={!!errors.batch_code}
              />
              {errors.batch_code && (
                <p className="text-xs text-destructive">
                  {errors.batch_code.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="breed">Breed</Label>
              <Controller
                control={control}
                name="breed"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="breed"
                      className="w-full"
                      aria-invalid={!!errors.breed}
                    >
                      <SelectValue>
                        {(v: string) => (v ? humanizeEnum(v) : "Select breed")}
                      </SelectValue>
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
              {errors.breed && (
                <p className="text-xs text-destructive">
                  {errors.breed.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="starting_date">Batch Starts</Label>
              <Input
                id="starting_date"
                type="date"
                {...register("starting_date")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_selling_date">
                Expected selling date
              </Label>
              <Input
                id="expected_selling_date"
                type="date"
                {...register("expected_selling_date")}
                aria-invalid={!!errors.expected_selling_date}
              />
              {errors.expected_selling_date && (
                <p className="text-xs text-destructive">
                  {errors.expected_selling_date.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initial_chick_count">Initial chicks</Label>
              <PositiveIntegerInput
                id="initial_chick_count"
                placeholder="e.g. 1000"
                {...register("initial_chick_count", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                aria-invalid={!!errors.initial_chick_count}
              />
              {errors.initial_chick_count && (
                <p className="text-xs text-destructive">
                  {errors.initial_chick_count.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="init_chicks_avg_wt">
                Avg weight per chick (g)
              </Label>
              <NumericInput
                id="init_chicks_avg_wt"
                placeholder="e.g. 30.2"
                allowDecimal
                decimalPlaces={2}
                {...register("init_chicks_avg_wt", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                aria-invalid={!!errors.init_chicks_avg_wt}
              />
              {errors.init_chicks_avg_wt && (
                <p className="text-xs text-destructive">
                  {errors.init_chicks_avg_wt.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="house_id">Initial house</Label>
            <Controller
              control={control}
              name="house_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger
                    id="house_id"
                    className="w-full"
                    aria-invalid={!!errors.house_id}
                  >
                    <SelectValue>
                      {(v: string) =>
                        houses?.results.find((h) => h.id === v)?.name ??
                        "Select house"
                      }
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
            {errors.house_id && (
              <p className="text-xs text-destructive">
                {errors.house_id.message}
              </p>
            )}
            {houses && houses.results.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No brooder houses available — all are occupied by a running batch.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recorded_by_id">Recorded by</Label>
            <Controller
              control={control}
              name="recorded_by_id"
              render={({ field }) => (
                <ActorSelect
                  id="recorded_by_id"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.recorded_by_id}
                />
              )}
            />
            {errors.recorded_by_id && (
              <p className="text-xs text-destructive">
                {errors.recorded_by_id.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

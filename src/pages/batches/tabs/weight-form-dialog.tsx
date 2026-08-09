import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { usePostData } from "@/lib/api";
import type { Batch, WeightRecord } from "@/pages/batches/types";

const weightSchema = z.object({
  house_id: z.string().min(1, "Select a house"),
  average_wt_grams: z.coerce.number().positive("Must be a positive number"),
  sample_size: z.coerce.number().int().positive("Must be a positive number"),
  date: z.string().min(1, "Date is required"),
  measured_by_id: z.string().min(1, "Select who measured this"),
});

type WeightFormInput = z.input<typeof weightSchema>;
type WeightFormValues = z.output<typeof weightSchema>;

type WeightFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function WeightFormDialog({ open, onOpenChange, batch }: WeightFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WeightFormInput, unknown, WeightFormValues>({
    resolver: zodResolver(weightSchema),
    defaultValues: {
      house_id: "",
      average_wt_grams: undefined,
      sample_size: undefined,
      date: new Date().toISOString().slice(0, 10),
      measured_by_id: "",
    },
  });

  // Dialog stays mounted between opens — without this, a second log would
  // start from whatever was left in the form after the previous submit.
  useEffect(() => {
    if (open) {
      reset({
        house_id: "",
        average_wt_grams: undefined,
        sample_size: undefined,
        date: new Date().toISOString().slice(0, 10),
        measured_by_id: "",
      });
    }
  }, [open, reset]);

  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);

  const createWeightRecord = usePostData<WeightRecord, WeightFormValues & { batch_id: string }>(
    "/weight-records",
    ["weight-records", batch.id]
  );

  const onSubmit = (values: WeightFormValues) => {
    createWeightRecord.mutate(
      { ...values, batch_id: batch.id },
      {
        onSuccess: () => {
          toast.success("Weight logged");
          onOpenChange(false);
        },
        onError: (error) => {
          let hadFieldError = false;
          for (const key of ["house_id", "average_wt_grams", "sample_size", "date", "measured_by_id"] as const) {
            const message = error.fieldError(key);
            if (message) {
              setError(key, { message });
              hadFieldError = true;
            }
          }
          if (!hadFieldError) {
            toast.error(
              error.status === 409 ? "A weight sample for this house and date already exists." : error.message
            );
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log weight sample</DialogTitle>
          <DialogDescription>{batch.batch_code}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="house_id">House</Label>
              <Controller
                control={control}
                name="house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="house_id" className="w-full" aria-invalid={!!errors.house_id}>
                      <SelectValue>
                        {(v: string) => occupiedHouses.find((b) => b.house_id === v)?.house.name ?? "Select house"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {occupiedHouses.map((b) => (
                        <SelectItem key={b.house_id} value={b.house_id}>
                          {b.house.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.house_id && <p className="text-xs text-destructive">{errors.house_id.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="average_wt_grams">Average weight (g)</Label>
              <Input
                id="average_wt_grams"
                type="number"
                step="0.01"
                {...register("average_wt_grams")}
                aria-invalid={!!errors.average_wt_grams}
              />
              {errors.average_wt_grams && (
                <p className="text-xs text-destructive">{errors.average_wt_grams.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sample_size">Sample size</Label>
              <Input
                id="sample_size"
                type="number"
                {...register("sample_size")}
                aria-invalid={!!errors.sample_size}
              />
              {errors.sample_size && <p className="text-xs text-destructive">{errors.sample_size.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="measured_by_id">Measured by</Label>
            <Controller
              control={control}
              name="measured_by_id"
              render={({ field }) => (
                <ActorSelect
                  id="measured_by_id"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.measured_by_id}
                />
              )}
            />
            {errors.measured_by_id && <p className="text-xs text-destructive">{errors.measured_by_id.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Log weight
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

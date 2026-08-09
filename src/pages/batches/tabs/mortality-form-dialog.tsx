import { useQueryClient } from "@tanstack/react-query";
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
import type { Batch, MortalityLog } from "@/pages/batches/types";

const mortalitySchema = z.object({
  house_id: z.string().min(1, "Select a house"),
  count_died: z.coerce.number().int().positive("Must be a positive number"),
  cause_note: z.string().trim().optional(),
  date: z.string().min(1, "Date is required"),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
});

type MortalityFormInput = z.input<typeof mortalitySchema>;
type MortalityFormValues = z.output<typeof mortalitySchema>;

type MortalityFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function MortalityFormDialog({ open, onOpenChange, batch }: MortalityFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MortalityFormInput, unknown, MortalityFormValues>({
    resolver: zodResolver(mortalitySchema),
    defaultValues: {
      house_id: "",
      count_died: undefined,
      cause_note: "",
      date: new Date().toISOString().slice(0, 10),
      recorded_by_id: "",
    },
  });

  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);
  const queryClient = useQueryClient();

  const createMortalityLog = usePostData<MortalityLog, MortalityFormValues & { batch_id: string }>(
    "/mortality-logs",
    ["mortality-logs", batch.id]
  );

  const onSubmit = (values: MortalityFormValues) => {
    const payload = { ...values, batch_id: batch.id, cause_note: values.cause_note || undefined };
    createMortalityLog.mutate(payload, {
      onSuccess: () => {
        // Mortality decrements the batch's house balances — the detail page's own
        // ["batches", id] query (and the list's ["batches", ...]) need to refetch too.
        void queryClient.invalidateQueries({ queryKey: ["batches"] });
        toast.success("Mortality logged");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["house_id", "count_died", "cause_note", "date", "recorded_by_id"] as const) {
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
          <DialogTitle>Log mortality</DialogTitle>
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
                          {b.house.name} ({b.quantity.toLocaleString()} live)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.house_id && <p className="text-xs text-destructive">{errors.house_id.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="count_died">Count died</Label>
              <Input id="count_died" type="number" {...register("count_died")} aria-invalid={!!errors.count_died} />
              {errors.count_died && <p className="text-xs text-destructive">{errors.count_died.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cause_note">Cause (optional)</Label>
            <Input id="cause_note" {...register("cause_note")} />
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
            {errors.recorded_by_id && <p className="text-xs text-destructive">{errors.recorded_by_id.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Log mortality
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

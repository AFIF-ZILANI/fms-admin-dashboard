import { useEffect } from "react";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { ALLOCATION_REASONS, type BatchHouseAllocation } from "@/pages/batches/types";
import type { House } from "@/pages/houses/types";

const allocationSchema = z
  .object({
    from_house_id: z.string().optional(),
    to_house_id: z.string().optional(),
    quantity: z.coerce.number().int().positive("Must be a positive number"),
    reason: z.enum(ALLOCATION_REASONS, "Select a reason"),
    recorded_by_id: z.string().min(1, "Select who's recording this"),
  })
  .refine((data) => data.from_house_id || data.to_house_id, {
    message: "Pick at least a from-house or a to-house",
    path: ["to_house_id"],
  });

type AllocationFormInput = z.input<typeof allocationSchema>;
type AllocationFormValues = z.output<typeof allocationSchema>;

type AllocationFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batchId: string };

export function AllocationFormDialog({ open, onOpenChange, batchId }: AllocationFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AllocationFormInput, unknown, AllocationFormValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { from_house_id: "", to_house_id: "", quantity: undefined, reason: undefined, recorded_by_id: "" },
  });

  // Dialog stays mounted between opens — without this, a second allocation would
  // start from whatever was left in the form after the previous submit.
  useEffect(() => {
    if (open) {
      reset({ from_house_id: "", to_house_id: "", quantity: undefined, reason: undefined, recorded_by_id: "" });
    }
  }, [open, reset]);

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const queryClient = useQueryClient();

  const createAllocation = usePostData<BatchHouseAllocation, AllocationFormValues & { batch_id: string }>(
    "/batch-house-allocations",
    ["batch-house-allocations", batchId]
  );

  const onSubmit = (values: AllocationFormValues) => {
    const payload = {
      ...values,
      batch_id: batchId,
      from_house_id: values.from_house_id || undefined,
      to_house_id: values.to_house_id || undefined,
    };
    createAllocation.mutate(payload, {
      onSuccess: () => {
        // Allocations move birds between house balances — refetch the batch (detail + list).
        void queryClient.invalidateQueries({ queryKey: ["batches"] });
        toast.success("Allocation recorded");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["from_house_id", "to_house_id", "quantity", "reason", "recorded_by_id"] as const) {
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

  const houseOptions = houses?.results ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record allocation</DialogTitle>
          <DialogDescription>
            Move birds between houses (transfer) or correct a headcount (adjustment).
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_house_id">From house (optional)</Label>
              <Controller
                control={control}
                name="from_house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="from_house_id" className="w-full">
                      <SelectValue>
                        {(v: string) => houseOptions.find((h) => h.id === v)?.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {houseOptions.map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          {house.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_house_id">To house (optional)</Label>
              <Controller
                control={control}
                name="to_house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="to_house_id" className="w-full" aria-invalid={!!errors.to_house_id}>
                      <SelectValue>
                        {(v: string) => houseOptions.find((h) => h.id === v)?.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {houseOptions.map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          {house.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {errors.to_house_id && <p className="-mt-2 text-xs text-destructive">{errors.to_house_id.message}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" {...register("quantity")} aria-invalid={!!errors.quantity} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="reason" className="w-full" aria-invalid={!!errors.reason}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select reason")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ALLOCATION_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {humanizeEnum(reason)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>
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
              Record allocation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

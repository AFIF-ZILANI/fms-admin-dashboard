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
import { ActorSelect } from "@/components/shared/actor-select";
import { DoctorSelect } from "@/components/shared/doctor-select";
import { usePostData } from "@/lib/api";
import type { Batch, Vaccination } from "@/pages/batches/types";

const vaccinationSchema = z.object({
  vaccine_name: z.string().min(1, "Vaccine name is required"),
  dosage: z.coerce.number().int().positive("Dosage must be positive"),
  cause: z.string().trim().optional(),
  period: z.string().trim().optional(),
  administered_by_id: z.string().min(1, "Select who administered this"),
  doctor_id: z.string().optional(),
  remarks: z.string().trim().optional(),
  date: z.string().min(1, "Date is required"),
});

type VaccinationFormInput = z.input<typeof vaccinationSchema>;
type VaccinationFormValues = z.output<typeof vaccinationSchema>;

function blankVaccination(): VaccinationFormInput {
  return {
    vaccine_name: "",
    dosage: undefined,
    cause: "",
    period: "",
    administered_by_id: "",
    doctor_id: "",
    remarks: "",
    date: new Date().toISOString().slice(0, 10),
  };
}

type VaccinationFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function VaccinationFormDialog({ open, onOpenChange, batch }: VaccinationFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VaccinationFormInput, unknown, VaccinationFormValues>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: blankVaccination(),
  });

  useEffect(() => {
    if (open) reset(blankVaccination());
  }, [open, reset]);

  const queryClient = useQueryClient();
  const createVaccination = usePostData<Vaccination, VaccinationFormValues & { batch_id: string }>(
    "/vaccinations",
    ["vaccinations", batch.id],
  );

  const onSubmit = (values: VaccinationFormValues) => {
    const payload = {
      ...values,
      batch_id: batch.id,
      cause: values.cause || undefined,
      period: values.period || undefined,
      doctor_id: values.doctor_id || undefined,
      remarks: values.remarks || undefined,
    };
    createVaccination.mutate(payload, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["vaccinations", batch.id] });
        toast.success("Vaccination logged");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["vaccine_name", "dosage", "administered_by_id", "date"] as const) {
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
          <DialogTitle>Log vaccination</DialogTitle>
          <DialogDescription>{batch.batch_code}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vaccine_name">Vaccine name</Label>
              <Input id="vaccine_name" {...register("vaccine_name")} aria-invalid={!!errors.vaccine_name} />
              {errors.vaccine_name && <p className="text-xs text-destructive">{errors.vaccine_name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dosage">Dosage</Label>
              <Input id="dosage" type="number" {...register("dosage")} aria-invalid={!!errors.dosage} />
              {errors.dosage && <p className="text-xs text-destructive">{errors.dosage.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cause">Cause (optional)</Label>
              <Input id="cause" {...register("cause")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period">Period (optional)</Label>
              <Input id="period" {...register("period")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="administered_by_id">Administered by</Label>
            <Controller
              control={control}
              name="administered_by_id"
              render={({ field }) => (
                <ActorSelect
                  id="administered_by_id"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.administered_by_id}
                />
              )}
            />
            {errors.administered_by_id && (
              <p className="text-xs text-destructive">{errors.administered_by_id.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doctor_id">Doctor (optional)</Label>
            <Controller
              control={control}
              name="doctor_id"
              render={({ field }) => (
                <DoctorSelect id="doctor_id" value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks (optional)</Label>
            <Input id="remarks" {...register("remarks")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Log vaccination
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

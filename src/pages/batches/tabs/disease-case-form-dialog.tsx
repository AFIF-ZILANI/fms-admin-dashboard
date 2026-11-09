import { useEffect } from "react";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PositiveIntegerInput } from "@/components/utils/NumaricInput";
import { DoctorSelect } from "@/components/shared/doctor-select";
import { usePatchData, usePostData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { humanizeEnum } from "@/lib/utils";
import { COMMON_SYMPTOMS, useDiseases } from "@/pages/batches/disease-cases";
import type { Batch, DiagnosisMethod, DiseaseCase, DiseaseSeverity } from "@/pages/batches/types";

const SEVERITIES: DiseaseSeverity[] = ["LOW", "MEDIUM", "HIGH"];
const METHODS: Record<DiagnosisMethod, string> = {
  FIELD: "Seen on the farm",
  POST_MORTEM: "Post-mortem",
  LAB: "Lab test",
};

const caseSchema = z.object({
  disease_id: z.string().min(1, "Pick a disease"),
  house_ids: z.array(z.string()).min(1, "Pick at least one house"),
  noticed_on: z.string().min(1, "Date is required"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  diagnosis_method: z.enum(["FIELD", "POST_MORTEM", "LAB"]),
  doctor_id: z.string().optional(),
  affected_count: z.string().optional(),
  symptoms: z.array(z.string()),
  other_symptoms: z.string().optional(),
  notes: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseSchema>;

function formValues(existing: DiseaseCase | undefined): CaseFormValues {
  if (!existing) {
    return {
      disease_id: "",
      house_ids: [],
      noticed_on: farmToday(),
      severity: "MEDIUM",
      diagnosis_method: "FIELD",
      doctor_id: "",
      affected_count: "",
      symptoms: [],
      other_symptoms: "",
      notes: "",
    };
  }
  return {
    disease_id: existing.disease.id,
    house_ids: existing.houses.map((h) => h.id),
    noticed_on: existing.noticed_on.slice(0, 10),
    severity: existing.severity,
    diagnosis_method: existing.diagnosis_method,
    doctor_id: existing.doctor?.id ?? "",
    affected_count: existing.affected_count?.toString() ?? "",
    symptoms: existing.symptoms.filter((s) => COMMON_SYMPTOMS.includes(s)),
    other_symptoms: existing.symptoms.filter((s) => !COMMON_SYMPTOMS.includes(s)).join(", "),
    notes: existing.notes ?? "",
  };
}

type Props = {
  batch: Batch;
  /** undefined = record a new case. */
  existing: DiseaseCase | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DiseaseCaseFormDialog({ batch, existing, open, onOpenChange }: Props) {
  const diseases = useDiseases();
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormValues>({ resolver: zodResolver(caseSchema), defaultValues: formValues(existing) });

  useEffect(() => {
    if (open) reset(formValues(existing));
  }, [open, existing, reset]);

  const key = ["disease-cases", batch.id];
  const create = usePostData<DiseaseCase, object>("/disease-cases", key);
  const update = usePatchData<DiseaseCase, object>(`/disease-cases/${existing?.id}`, key);

  // Every house the batch was ever placed in -- a case can be recorded after birds moved on.
  const houses = batch.houseBalances;
  // A deactivated disease still shows on the case it's already on.
  const diseaseOptions =
    existing && !diseases.some((d) => d.id === existing.disease.id)
      ? [...diseases, { ...existing.disease, is_active: false }]
      : diseases;

  const onSubmit = (values: CaseFormValues) => {
    const symptoms = [
      ...values.symptoms,
      ...(values.other_symptoms ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ];
    const payload = {
      disease_id: values.disease_id,
      house_ids: values.house_ids,
      noticed_on: values.noticed_on,
      severity: values.severity,
      diagnosis_method: values.diagnosis_method,
      doctor_id: values.doctor_id || null,
      affected_count: values.affected_count ? Number(values.affected_count) : null,
      symptoms,
      notes: values.notes?.trim() || null,
    };
    const mutation = existing ? update : create;
    return mutation.mutate(existing ? payload : { ...payload, batch_id: batch.id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["disease-case"] });
        toast.success(existing ? "Disease case updated" : "Disease case recorded");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const k of ["disease_id", "house_ids", "noticed_on"] as const) {
          const message = error.fieldError(k);
          if (message) {
            setError(k, { message });
            hadFieldError = true;
          }
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit disease case" : "Record disease case"}</DialogTitle>
          <DialogDescription>{batch.batch_code}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disease_id">Disease</Label>
              <Controller
                control={control}
                name="disease_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="disease_id" className="w-full" aria-invalid={!!errors.disease_id}>
                      <SelectValue>
                        {(v: string) => diseaseOptions.find((d) => d.id === v)?.label ?? "Select disease"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {diseaseOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.disease_id && <p className="text-xs text-destructive">{errors.disease_id.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="noticed_on">First noticed</Label>
              <Input id="noticed_on" type="date" {...register("noticed_on")} aria-invalid={!!errors.noticed_on} />
              {errors.noticed_on && <p className="text-xs text-destructive">{errors.noticed_on.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Houses affected</Label>
            <Controller
              control={control}
              name="house_ids"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {houses.map((b) => (
                    <label key={b.house_id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(b.house_id)}
                        onCheckedChange={(on) =>
                          field.onChange(
                            on ? [...field.value, b.house_id] : field.value.filter((id) => id !== b.house_id)
                          )
                        }
                      />
                      {b.house.name}
                      <span className="text-muted-foreground tabular-nums">({b.quantity.toLocaleString()} live)</span>
                    </label>
                  ))}
                </div>
              )}
            />
            {errors.house_ids && <p className="text-xs text-destructive">{errors.house_ids.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="severity">Severity</Label>
              <Controller
                control={control}
                name="severity"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger id="severity" className="w-full">
                      <SelectValue>{(v: string) => humanizeEnum(v)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {humanizeEnum(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="affected_count">Birds sick (optional)</Label>
              <PositiveIntegerInput id="affected_count" placeholder="Estimate" {...register("affected_count")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="diagnosis_method">Diagnosed by</Label>
              <Controller
                control={control}
                name="diagnosis_method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <SelectTrigger id="diagnosis_method" className="w-full">
                      <SelectValue>{(v: DiagnosisMethod) => METHODS[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHODS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doctor_id">Doctor (optional)</Label>
              <Controller
                control={control}
                name="doctor_id"
                render={({ field }) => <DoctorSelect id="doctor_id" value={field.value ?? ""} onChange={field.onChange} />}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Symptoms</Label>
            <Controller
              control={control}
              name="symptoms"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {COMMON_SYMPTOMS.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(s)}
                        onCheckedChange={(on) =>
                          field.onChange(on ? [...field.value, s] : field.value.filter((x) => x !== s))
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
              )}
            />
            <Input placeholder="Other symptoms, comma separated" {...register("other_symptoms")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {existing ? "Save" : "Record case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

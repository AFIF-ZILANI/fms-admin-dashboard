import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Check, FlaskConical, Info, Loader2, Microscope, Eye, type LucideIcon } from "lucide-react";
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
import { PositiveIntegerInput } from "@/components/utils/NumaricInput";
import { DoctorSelect } from "@/components/shared/doctor-select";
import { usePatchData, usePostData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { cn } from "@/lib/utils";
import { COMMON_SYMPTOMS, useDiseases } from "@/pages/batches/disease-cases";
import type { Batch, DiagnosisMethod, DiseaseCase, DiseaseSeverity } from "@/pages/batches/types";

// Selected severity takes its status tone (with icon + label, never color alone -- docs/design.md §6).
const SEVERITIES: { value: DiseaseSeverity; label: string; hint: string; icon: LucideIcon; selected: string }[] = [
  { value: "LOW", label: "Low", hint: "A few birds", icon: Info, selected: "border-info bg-info/10 text-info" },
  { value: "MEDIUM", label: "Medium", hint: "Spreading", icon: AlertTriangle, selected: "border-warning bg-warning/10 text-warning" },
  { value: "HIGH", label: "High", hint: "Many sick or dying", icon: AlertCircle, selected: "border-critical bg-critical/10 text-critical" },
];
const METHODS: { value: DiagnosisMethod; label: string; icon: LucideIcon }[] = [
  { value: "FIELD", label: "Seen on the farm", icon: Eye },
  { value: "POST_MORTEM", label: "Post-mortem", icon: Microscope },
  { value: "LAB", label: "Lab test", icon: FlaskConical },
];

/** A pill that toggles on and off -- for picking houses and symptoms at a glance. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
      )}
    >
      {on && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** One titled group of fields in the dialog body. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle>{existing ? "Edit disease case" : "Record disease case"}</DialogTitle>
          <DialogDescription>
            {batch.batch_code} · treatments and deaths are linked to the case from their own forms.
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            <Section title="What and where">
              <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
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
                    <div className="flex flex-wrap gap-2">
                      {houses.map((b) => (
                        <Chip
                          key={b.house_id}
                          on={field.value.includes(b.house_id)}
                          onClick={() => field.onChange(toggle(field.value, b.house_id))}
                        >
                          {b.house.name}
                          <span className="tabular-nums opacity-70">{b.quantity.toLocaleString()}</span>
                        </Chip>
                      ))}
                    </div>
                  )}
                />
                {errors.house_ids && <p className="text-xs text-destructive">{errors.house_ids.message}</p>}
              </div>
            </Section>

            <Section title="How bad">
              <Controller
                control={control}
                name="severity"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Severity" className="grid grid-cols-3 gap-2">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === s.value}
                        onClick={() => field.onChange(s.value)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
                          field.value === s.value ? s.selected : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <s.icon className="size-4" />
                          {s.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{s.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              />
              <div className="flex max-w-56 flex-col gap-1.5">
                <Label htmlFor="affected_count">Birds sick (optional)</Label>
                <PositiveIntegerInput id="affected_count" placeholder="Estimate" {...register("affected_count")} />
              </div>
            </Section>

            <Section title="Diagnosis">
              <Controller
                control={control}
                name="diagnosis_method"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Diagnosed by" className="inline-flex w-fit rounded-lg border p-0.5">
                    {METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === m.value}
                        onClick={() => field.onChange(m.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                          field.value === m.value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <m.icon className="size-4" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              />
              <div className="flex max-w-xs flex-col gap-1.5">
                <Label htmlFor="doctor_id">Doctor (optional)</Label>
                <Controller
                  control={control}
                  name="doctor_id"
                  render={({ field }) => <DoctorSelect id="doctor_id" value={field.value ?? ""} onChange={field.onChange} />}
                />
              </div>
            </Section>

            <Section title="Symptoms and notes">
              <Controller
                control={control}
                name="symptoms"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {COMMON_SYMPTOMS.map((s) => (
                      <Chip key={s} on={field.value.includes(s)} onClick={() => field.onChange(toggle(field.value, s))}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}
              />
              <Input placeholder="Other symptoms, comma separated" {...register("other_symptoms")} />
              <textarea
                id="notes"
                aria-label="Notes"
                rows={3}
                placeholder="Notes (optional): what you saw, what the doctor said"
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                {...register("notes")}
              />
            </Section>
          </div>

          <DialogFooter className="m-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {existing ? "Save changes" : "Record case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

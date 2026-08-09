import { useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActorSelect } from "@/components/shared/actor-select";
import { usePostData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { CRITERIA, criterionPoints, type PerformanceScoreEntry } from "@/pages/employees/types";

const scoreEntrySchema = z
  .object({
    criterion: z.enum(CRITERIA, "Select a criterion"),
    points: z.coerce.number().int().optional(),
    reason: z.string().trim().min(1, "Reason is required"),
    date: z.string().min(1, "Date is required"),
    given_by_id: z.string().min(1, "Select who's giving this"),
  })
  .refine(
    (data) =>
      data.criterion !== "OTHER" ||
      (data.points !== undefined && data.points !== 0 && Math.abs(data.points) <= 5),
    { message: "OTHER requires points between -5 and 5, excluding 0", path: ["points"] }
  );

type ScoreEntryFormInput = z.input<typeof scoreEntrySchema>;
type ScoreEntryFormValues = z.output<typeof scoreEntrySchema>;

function blankScoreEntry(): ScoreEntryFormInput {
  return {
    criterion: undefined as unknown as ScoreEntryFormInput["criterion"],
    points: undefined,
    reason: "",
    date: new Date().toISOString().slice(0, 10),
    given_by_id: "",
  };
}

type ScoreEntryDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; employeeId: string };

export function ScoreEntryDialog({ open, onOpenChange, employeeId }: ScoreEntryDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScoreEntryFormInput, unknown, ScoreEntryFormValues>({
    resolver: zodResolver(scoreEntrySchema),
    defaultValues: blankScoreEntry(),
  });

  useEffect(() => {
    if (open) reset(blankScoreEntry());
  }, [open, reset]);

  const criterion = useWatch({ control, name: "criterion" });
  const isOther = criterion === "OTHER";

  const createScoreEntry = usePostData<
    PerformanceScoreEntry,
    ScoreEntryFormValues & { employee_id: string; idempotency_key: string }
  >("/performance-score-entries", ["performance-score-entries"]);

  const onSubmit = (values: ScoreEntryFormValues) => {
    const payload = {
      ...values,
      points: isOther ? values.points : undefined,
      employee_id: employeeId,
      idempotency_key: crypto.randomUUID(),
    };
    createScoreEntry.mutate(payload, {
      onSuccess: () => {
        toast.success("Score entry recorded");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.fieldError("reason") ?? error.fieldError("points") ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add score entry</DialogTitle>
          <DialogDescription>
            Every fixed criterion has a set point value — only OTHER lets you set a custom ±1 to ±5.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="criterion">Criterion</Label>
            <Controller
              control={control}
              name="criterion"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="criterion" className="w-full" aria-invalid={!!errors.criterion}>
                    <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select criterion")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CRITERIA.map((c) => (
                      <SelectItem key={c} value={c}>
                        {humanizeEnum(c)}
                        {c !== "OTHER" && ` (${criterionPoints(c) > 0 ? "+" : ""}${criterionPoints(c)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.criterion && <p className="text-xs text-destructive">{errors.criterion.message}</p>}
          </div>

          {isOther ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points">Points (-5 to 5, not 0)</Label>
              <Input id="points" type="number" step="1" {...register("points")} aria-invalid={!!errors.points} />
              {errors.points && <p className="text-xs text-destructive">{errors.points.message}</p>}
            </div>
          ) : criterion ? (
            <p className="text-xs text-muted-foreground">
              This criterion is worth{" "}
              <span className="font-medium">
                {criterionPoints(criterion) > 0 ? "+" : ""}
                {criterionPoints(criterion)}
              </span>{" "}
              points.
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" {...register("reason")} aria-invalid={!!errors.reason} />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="given_by_id">Given by</Label>
              <Controller
                control={control}
                name="given_by_id"
                render={({ field }) => (
                  <ActorSelect
                    id="given_by_id"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    invalid={!!errors.given_by_id}
                  />
                )}
              />
              {errors.given_by_id && <p className="text-xs text-destructive">{errors.given_by_id.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Add entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

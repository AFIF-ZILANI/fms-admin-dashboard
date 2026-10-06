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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePostData } from "@/lib/api";
import { RELIGIONS, RELIGION_LABELS, type Religion } from "@/pages/employees/types";
import type { BonusEvent } from "@/pages/bonuses/types";

const FARM_WIDE = "none";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  event_date: z.string().min(1, "Date is required"),
  religion: z.string(), // FARM_WIDE or a Religion
  multiplier: z.coerce.number().positive("Must be positive").max(24, "Too large"),
  min_service_months: z.coerce.number().int().min(0, "Can't be negative"),
  prorate: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const blank: FormInput = {
  name: "",
  event_date: "",
  religion: FARM_WIDE,
  multiplier: 1,
  min_service_months: 12,
  prorate: true,
};

export function EventFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: BonusEvent) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: blank });

  useEffect(() => {
    if (open) reset(blank);
  }, [open, reset]);

  const create = usePostData<BonusEvent, object>("/bonus-events", ["bonus-events"]);

  const onSubmit = (v: FormValues) => {
    create.mutate(
      {
        name: v.name,
        event_date: v.event_date,
        religion: v.religion === FARM_WIDE ? null : v.religion,
        multiplier: v.multiplier,
        min_service_months: v.min_service_months,
        prorate: v.prorate,
      },
      {
        onSuccess: (event) => {
          toast.success("Bonus event created");
          onOpenChange(false);
          onCreated(event);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New bonus event</DialogTitle>
          <DialogDescription>
            Creating it grants nothing. Next you'll see who the system proposes and choose who to pay.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Eid ul-Fitr 2026" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event_date">Date</Label>
              <Input id="event_date" type="date" {...register("event_date")} aria-invalid={!!errors.event_date} />
              {errors.event_date && <p className="text-xs text-destructive">{errors.event_date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="religion">For</Label>
              <Controller
                control={control}
                name="religion"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? FARM_WIDE)}>
                    <SelectTrigger id="religion" className="w-full">
                      <SelectValue>
                        {(v: string) => (v === FARM_WIDE ? "Everyone (farm-wide)" : RELIGION_LABELS[v as Religion])}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FARM_WIDE}>Everyone (farm-wide)</SelectItem>
                      {RELIGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {RELIGION_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="multiplier">Multiplier × salary</Label>
              <Input id="multiplier" type="number" step="0.25" {...register("multiplier")} aria-invalid={!!errors.multiplier} />
              {errors.multiplier && <p className="text-xs text-destructive">{errors.multiplier.message}</p>}
              <p className="text-xs text-muted-foreground">1 = one month's reference salary.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min_service_months">Full bonus after (months)</Label>
              <Input
                id="min_service_months"
                type="number"
                {...register("min_service_months")}
                aria-invalid={!!errors.min_service_months}
              />
              {errors.min_service_months && (
                <p className="text-xs text-destructive">{errors.min_service_months.message}</p>
              )}
            </div>
          </div>
          <Controller
            control={control}
            name="prorate"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} className="mt-0.5" />
                <span>
                  Prorate for shorter service
                  <span className="block text-xs text-muted-foreground">
                    Pay service months ÷ 12 of the full amount instead of nothing.
                  </span>
                </span>
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || create.isPending}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

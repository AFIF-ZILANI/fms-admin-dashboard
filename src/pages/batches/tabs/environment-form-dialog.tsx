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
import { humanizeEnum } from "@/lib/utils";
import { TIME_PERIODS, type Batch, type EnvironmentRecord } from "@/pages/batches/types";

const environmentSchema = z.object({
  house_id: z.string().min(1, "Select a house"),
  temperature_c: z.coerce.number(),
  humidity_percent: z.coerce.number(),
  ammonia_ppm: z.coerce.number(),
  co2_ppm: z.coerce.number(),
  air_pressure_hpa: z.coerce.number(),
  time_period: z.enum(TIME_PERIODS, "Select a time of day"),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
});

type EnvironmentFormInput = z.input<typeof environmentSchema>;
type EnvironmentFormValues = z.output<typeof environmentSchema>;

type EnvironmentFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; batch: Batch };

export function EnvironmentFormDialog({ open, onOpenChange, batch }: EnvironmentFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EnvironmentFormInput, unknown, EnvironmentFormValues>({
    resolver: zodResolver(environmentSchema),
    defaultValues: {
      house_id: "",
      temperature_c: undefined,
      humidity_percent: undefined,
      ammonia_ppm: undefined,
      co2_ppm: undefined,
      air_pressure_hpa: undefined,
      time_period: undefined,
      recorded_by_id: "",
    },
  });

  // Dialog stays mounted between opens — without this, a second log would
  // start from whatever was left in the form after the previous submit.
  useEffect(() => {
    if (open) {
      reset({
        house_id: "",
        temperature_c: undefined,
        humidity_percent: undefined,
        ammonia_ppm: undefined,
        co2_ppm: undefined,
        air_pressure_hpa: undefined,
        time_period: undefined,
        recorded_by_id: "",
      });
    }
  }, [open, reset]);

  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);

  const createRecord = usePostData<EnvironmentRecord, EnvironmentFormValues & { batch_id: string }>(
    "/environment-records",
    ["environment-records", batch.id]
  );

  const onSubmit = (values: EnvironmentFormValues) => {
    createRecord.mutate(
      { ...values, batch_id: batch.id },
      {
        onSuccess: () => {
          toast.success("Environment reading logged");
          onOpenChange(false);
        },
        onError: (error) => {
          let hadFieldError = false;
          for (const key of [
            "house_id",
            "temperature_c",
            "humidity_percent",
            "ammonia_ppm",
            "co2_ppm",
            "air_pressure_hpa",
            "time_period",
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
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log environment reading</DialogTitle>
          <DialogDescription>{batch.batch_code} — logged for right now.</DialogDescription>
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
              <Label htmlFor="time_period">Time of day</Label>
              <Controller
                control={control}
                name="time_period"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="time_period" className="w-full" aria-invalid={!!errors.time_period}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_PERIODS.map((period) => (
                        <SelectItem key={period} value={period}>
                          {humanizeEnum(period)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.time_period && <p className="text-xs text-destructive">{errors.time_period.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temperature_c">Temperature (°C)</Label>
              <Input id="temperature_c" type="number" step="0.1" {...register("temperature_c")} aria-invalid={!!errors.temperature_c} />
              {errors.temperature_c && <p className="text-xs text-destructive">{errors.temperature_c.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="humidity_percent">Humidity (%)</Label>
              <Input
                id="humidity_percent"
                type="number"
                step="0.1"
                {...register("humidity_percent")}
                aria-invalid={!!errors.humidity_percent}
              />
              {errors.humidity_percent && (
                <p className="text-xs text-destructive">{errors.humidity_percent.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ammonia_ppm">Ammonia (ppm)</Label>
              <Input id="ammonia_ppm" type="number" step="0.1" {...register("ammonia_ppm")} aria-invalid={!!errors.ammonia_ppm} />
              {errors.ammonia_ppm && <p className="text-xs text-destructive">{errors.ammonia_ppm.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="co2_ppm">CO2 (ppm)</Label>
              <Input id="co2_ppm" type="number" step="0.1" {...register("co2_ppm")} aria-invalid={!!errors.co2_ppm} />
              {errors.co2_ppm && <p className="text-xs text-destructive">{errors.co2_ppm.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="air_pressure_hpa">Pressure (hPa)</Label>
              <Input
                id="air_pressure_hpa"
                type="number"
                step="0.1"
                {...register("air_pressure_hpa")}
                aria-invalid={!!errors.air_pressure_hpa}
              />
              {errors.air_pressure_hpa && (
                <p className="text-xs text-destructive">{errors.air_pressure_hpa.message}</p>
              )}
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
              Log reading
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

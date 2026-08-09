import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import { BIRD_GRADES, type BirdSale } from "@/pages/sales/types";

const birdSaleSchema = z
  .object({
    batch_id: z.string().min(1, "Select a batch"),
    house_id: z.string().min(1, "Select a house"),
    customer_id: z.string().optional(),
    sale_date: z.string().min(1, "Sale date is required"),
    grade: z.enum(BIRD_GRADES, "Select a grade"),
    male_count: optionalNumber(z.coerce.number().int().nonnegative()),
    female_count: optionalNumber(z.coerce.number().int().nonnegative()),
    birds_count: z.coerce.number().int().positive("Must be positive"),
    dholta_in_g: z.coerce.number().nonnegative("Must be 0 or more"),
    total_katha: z.coerce.number().int().nonnegative("Must be 0 or more"),
    avg_wt_per_katha_kg: optionalNumber(z.coerce.number().positive()),
    total_weight: z.coerce.number().positive("Must be positive"),
    net_weight: z.coerce.number().positive("Must be positive"),
    avg_weight_g: optionalNumber(z.coerce.number().positive()),
    price_per_kg: z.coerce.number().positive("Must be positive"),
    paid_amount: optionalNumber(z.coerce.number().nonnegative()),
    recorded_by_id: z.string().min(1, "Select who's recording this"),
  })
  .refine(
    (data) =>
      data.male_count === undefined ||
      data.female_count === undefined ||
      data.male_count + data.female_count === data.birds_count,
    { message: "Male + female count must equal bird count", path: ["female_count"] }
  );

type BirdSaleFormInput = z.input<typeof birdSaleSchema>;
type BirdSaleFormValues = z.output<typeof birdSaleSchema>;

function blankBirdSale(): BirdSaleFormInput {
  return {
    batch_id: "",
    house_id: "",
    customer_id: "",
    sale_date: new Date().toISOString().slice(0, 10),
    grade: undefined as unknown as BirdSaleFormInput["grade"],
    male_count: "",
    female_count: "",
    birds_count: undefined,
    dholta_in_g: undefined,
    total_katha: undefined,
    avg_wt_per_katha_kg: "",
    total_weight: undefined,
    net_weight: undefined,
    avg_weight_g: "",
    price_per_kg: undefined,
    paid_amount: "",
    recorded_by_id: "",
  };
}

type BirdSaleCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function BirdSaleCreateDialog({ open, onOpenChange }: BirdSaleCreateDialogProps) {
  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BirdSaleFormInput, unknown, BirdSaleFormValues>({
    resolver: zodResolver(birdSaleSchema),
    defaultValues: blankBirdSale(),
  });

  useEffect(() => {
    if (open) reset(blankBirdSale());
  }, [open, reset]);

  const batchId = useWatch({ control, name: "batch_id" });
  const netWeight = useWatch({ control, name: "net_weight" });
  const pricePerKg = useWatch({ control, name: "price_per_kg" });

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);

  const createBirdSale = usePostData<BirdSale, BirdSaleFormValues>("/bird-sales", ["bird-sales"]);

  const selectedBatch = batches?.results.find((b) => b.id === batchId);
  const houseOptions = (selectedBatch?.houseBalances ?? []).filter((hb) => hb.quantity > 0);
  const totalPreview = (Number(netWeight) || 0) * (Number(pricePerKg) || 0);

  const onSubmit = (values: BirdSaleFormValues) => {
    const payload = { ...values, customer_id: values.customer_id || undefined };
    createBirdSale.mutate(payload, {
      onSuccess: () => {
        toast.success("Bird sale recorded");
        onOpenChange(false);
        navigate("/sales");
      },
      onError: (error) => {
        const message =
          error.fieldError("sale_date") ??
          error.fieldError("recorded_by_id") ??
          error.fieldError("birds_count");
        toast.error(message ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record bird sale</DialogTitle>
          <DialogDescription>
            Sells birds out of a batch's house balance. Total amount = net weight × price per kg.
          </DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch_id">Batch</Label>
              <Controller
                control={control}
                name="batch_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => {
                      field.onChange(v);
                    }}
                  >
                    <SelectTrigger id="batch_id" className="w-full" aria-invalid={!!errors.batch_id}>
                      <SelectValue>
                        {(v: string) => batches?.results.find((b) => b.id === v)?.batch_code ?? "Select batch"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(batches?.results ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.batch_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.batch_id && <p className="text-xs text-destructive">{errors.batch_id.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="house_id">House</Label>
              <Controller
                control={control}
                name="house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!batchId}>
                    <SelectTrigger id="house_id" className="w-full" aria-invalid={!!errors.house_id}>
                      <SelectValue>
                        {(v: string) => houseOptions.find((hb) => hb.house_id === v)?.house.name ?? "Select house"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {houseOptions.map((hb) => (
                        <SelectItem key={hb.house_id} value={hb.house_id}>
                          {hb.house.name} ({hb.quantity} live)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.house_id && <p className="text-xs text-destructive">{errors.house_id.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_id">Customer (optional)</Label>
              <Controller
                control={control}
                name="customer_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="customer_id" className="w-full">
                      <SelectValue>
                        {(v: string) => customers?.results.find((c) => c.id === v)?.profile.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(customers?.results ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale_date">Sale date</Label>
              <Input id="sale_date" type="date" {...register("sale_date")} aria-invalid={!!errors.sale_date} />
              {errors.sale_date && <p className="text-xs text-destructive">{errors.sale_date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grade">Grade</Label>
              <Controller
                control={control}
                name="grade"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="grade" className="w-full" aria-invalid={!!errors.grade}>
                      <SelectValue>{(v: string) => v || "Select grade"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {BIRD_GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.grade && <p className="text-xs text-destructive">{errors.grade.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birds_count">Bird count</Label>
              <Input id="birds_count" type="number" {...register("birds_count")} aria-invalid={!!errors.birds_count} />
              {errors.birds_count && <p className="text-xs text-destructive">{errors.birds_count.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="male_count">Male count (optional)</Label>
              <Input id="male_count" type="number" {...register("male_count")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="female_count">Female count (optional)</Label>
              <Input id="female_count" type="number" {...register("female_count")} />
              {errors.female_count && <p className="text-xs text-destructive">{errors.female_count.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dholta_in_g">Dholta (g)</Label>
              <Input id="dholta_in_g" type="number" step="0.01" {...register("dholta_in_g")} aria-invalid={!!errors.dholta_in_g} />
              {errors.dholta_in_g && <p className="text-xs text-destructive">{errors.dholta_in_g.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total_katha">Total katha</Label>
              <Input id="total_katha" type="number" {...register("total_katha")} aria-invalid={!!errors.total_katha} />
              {errors.total_katha && <p className="text-xs text-destructive">{errors.total_katha.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avg_wt_per_katha_kg">Avg wt/katha (kg, optional)</Label>
              <Input id="avg_wt_per_katha_kg" type="number" step="0.01" {...register("avg_wt_per_katha_kg")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total_weight">Total weight (kg)</Label>
              <Input id="total_weight" type="number" step="0.01" {...register("total_weight")} aria-invalid={!!errors.total_weight} />
              {errors.total_weight && <p className="text-xs text-destructive">{errors.total_weight.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="net_weight">Net weight (kg)</Label>
              <Input id="net_weight" type="number" step="0.01" {...register("net_weight")} aria-invalid={!!errors.net_weight} />
              {errors.net_weight && <p className="text-xs text-destructive">{errors.net_weight.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avg_weight_g">Avg weight (g, optional)</Label>
              <Input id="avg_weight_g" type="number" step="0.01" {...register("avg_weight_g")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price_per_kg">Price per kg</Label>
              <Input id="price_per_kg" type="number" step="0.01" {...register("price_per_kg")} aria-invalid={!!errors.price_per_kg} />
              {errors.price_per_kg && <p className="text-xs text-destructive">{errors.price_per_kg.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid_amount">Paid amount (optional, default 0)</Label>
              <Input id="paid_amount" type="number" step="0.01" {...register("paid_amount")} />
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

          <div className="flex justify-end text-sm font-medium tabular-nums">
            Total: {formatMoney(totalPreview)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Record bird sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

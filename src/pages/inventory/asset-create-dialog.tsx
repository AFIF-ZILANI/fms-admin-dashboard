import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { Asset, StockUnit } from "@/pages/inventory/types";

const assetSchema = z.object({
  stock_unit_id: z.string().min(1, "Select a coded unit"),
  name: z.string().trim().min(1, "Name is required"),
  purchase_cost: z.coerce.number().positive("Must be positive"),
  purchase_date: z.string().min(1, "Purchase date is required"),
  useful_life_batches: z.coerce.number().int().positive("Must be a positive number"),
});
type AssetFormInput = z.input<typeof assetSchema>;
type AssetFormValues = z.output<typeof assetSchema>;

type AssetCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function AssetCreateDialog({ open, onOpenChange }: AssetCreateDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormInput, unknown, AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      stock_unit_id: "",
      name: "",
      purchase_cost: undefined,
      purchase_date: "",
      useful_life_batches: undefined,
    },
  });

  // Eligible = an EQUIPMENT-category coded unit that's in stock and isn't already an asset.
  // ponytail: "EQUIPMENT" is a live ItemCategory.code a user can rename via
  // Settings, which silently breaks this query with no error -- needs a
  // stable-key mechanism (e.g. an is_system flag) if renaming this
  // specific category becomes a real risk.
  const { data: eligibleUnits } = useGetData<Paginated<StockUnit>>(
    "/stock-units?status=IN_STOCK&category=EQUIPMENT&limit=100",
    ["stock-units", "eligible-for-asset"]
  );
  const units = (eligibleUnits?.results ?? []).filter((u) => !u.asset);

  const queryClient = useQueryClient();
  // ponytail: usePostData's `key` is a single queryKey prefix, not a list of namespaces to
  // invalidate — ["assets", "stock-units"] would only match a query literally keyed that way
  // (none exist). Invalidate the two real namespaces separately, matching adjustment-form-dialog.tsx.
  const createAsset = usePostData<Asset, AssetFormValues>("/assets", ["assets"]);

  const onSubmit = (values: AssetFormValues) => {
    createAsset.mutate(values, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["stock-units"] });
        toast.success("Asset created");
        reset();
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["stock_unit_id", "name", "purchase_cost", "purchase_date", "useful_life_batches"] as const) {
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
          <DialogTitle>Add asset</DialogTitle>
          <DialogDescription>Register an equipment coded unit as a depreciating asset.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock_unit_id">Coded unit</Label>
            <Controller
              control={control}
              name="stock_unit_id"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="stock_unit_id" className="w-full" aria-invalid={!!errors.stock_unit_id}>
                    <SelectValue>
                      {(v: string) => {
                        const unit = units.find((u) => u.id === v);
                        return unit ? `${unit.code} — ${unit.purchase_item?.item.name ?? ""}` : "Select coded unit";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} — {unit.purchase_item?.item.name ?? "Unknown item"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.stock_unit_id && <p className="text-xs text-destructive">{errors.stock_unit_id.message}</p>}
            {units.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No eligible equipment units — bind an equipment code in the Coded Units tab first.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Incubator" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase_cost">Purchase cost</Label>
              <Input
                id="purchase_cost"
                type="number"
                step="0.01"
                {...register("purchase_cost")}
                aria-invalid={!!errors.purchase_cost}
              />
              {errors.purchase_cost && <p className="text-xs text-destructive">{errors.purchase_cost.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="purchase_date">Purchase date</Label>
              <Input
                id="purchase_date"
                type="date"
                {...register("purchase_date")}
                aria-invalid={!!errors.purchase_date}
              />
              {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="useful_life_batches">Useful life (batches)</Label>
            <Input
              id="useful_life_batches"
              type="number"
              step="1"
              {...register("useful_life_batches")}
              aria-invalid={!!errors.useful_life_batches}
            />
            {errors.useful_life_batches && (
              <p className="text-xs text-destructive">{errors.useful_life_batches.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

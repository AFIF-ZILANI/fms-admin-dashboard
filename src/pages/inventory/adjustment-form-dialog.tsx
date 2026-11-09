import { Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ADJUSTMENT_REASONS, type InventoryAdjustment, type Item, type LocationStockRow, type Warehouse } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import { formatStock } from "@/pages/inventory/stock-qty";

const adjustmentSchema = z
  .object({
    item_id: z.string().min(1, "Select an item"),
    warehouse_id: z.string().optional(),
    house_id: z.string().optional(),
    quantity_before: z.coerce.number().nonnegative("Must be 0 or more"),
    quantity_after: z.coerce.number().nonnegative("Must be 0 or more"),
    reason: z.string().trim().min(1, "Reason is required"),
    note: z.string().optional(),
  })
  .refine((data) => data.warehouse_id || data.house_id, {
    message: "Pick a warehouse or a house",
    path: ["warehouse_id"],
  })
  .refine((data) => data.quantity_after !== data.quantity_before, {
    message: "Quantity after must differ from quantity before",
    path: ["quantity_after"],
  });

// z.coerce fields make the schema's input type (raw form values) differ from
// its output type (parsed payload) — RHF's 3rd generic carries that through (same pattern as Items).
type AdjustmentFormInput = z.input<typeof adjustmentSchema>;
type AdjustmentFormValues = z.output<typeof adjustmentSchema>;

type AdjustmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdjustmentFormDialog({ open, onOpenChange }: AdjustmentFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormInput, unknown, AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      item_id: "",
      warehouse_id: "",
      house_id: "",
      quantity_before: undefined,
      quantity_after: undefined,
      reason: "",
      note: "",
    },
  });

  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);

  const queryClient = useQueryClient();
  const createAdjustment = usePostData<InventoryAdjustment, Record<string, unknown>>("/inventory-adjustments", [
    "inventory-adjustments",
  ]);

  // register()'d number inputs watch() as raw strings (no valueAsNumber), so
  // `typeof === "number"` never matches what the user typed -- coerce first.
  // Number("") is 0, not NaN, so an untouched/cleared field must be excluded
  // explicitly or the preview would show a false "Delta: 0" before any input.
  const toNum = (v: unknown) => (v === undefined || v === "" ? NaN : Number(v));
  const before = toNum(watch("quantity_before"));
  const after = toNum(watch("quantity_after"));
  const delta = !Number.isNaN(before) && !Number.isNaN(after) ? after - before : null;

  const selectedItemId = watch("item_id");

  // Current on-hand balance at whichever location is selected, so the user can see what's
  // already there before typing quantity_before -- house wins if
  // both are set, same tie-break the backend uses (inventory-adjustment.service.ts).
  const selectedWarehouseId = watch("warehouse_id");
  const selectedHouseId = watch("house_id");
  const { data: warehouseStock } = useGetData<LocationStockRow[]>(
    `/warehouses/${selectedWarehouseId}/stock`,
    ["warehouses", selectedWarehouseId, "stock"],
    { enabled: !!selectedWarehouseId }
  );
  const { data: houseStock } = useGetData<LocationStockRow[]>(
    `/houses/${selectedHouseId}/stock`,
    ["houses", selectedHouseId, "stock"],
    { enabled: !!selectedHouseId }
  );
  const currentBalance =
    (selectedHouseId && houseStock?.find((s) => s.item_id === selectedItemId)) ||
    (selectedWarehouseId && warehouseStock?.find((s) => s.item_id === selectedItemId)) ||
    undefined;

  const onSubmit = (values: AdjustmentFormValues) => {
    const { warehouse_id, house_id, ...rest } = values;
    return createAdjustment.mutate(
      {
        ...rest,
        ...(warehouse_id && { warehouse_id }),
        ...(house_id && { house_id }),
      },
      {
        onSuccess: () => {
          // An adjustment changes stock balances -- the Stock Ledger and item
          // balances (e.g. Low-Stock KPI) need to refetch too, same pattern as
          // mortality-form-dialog.tsx invalidating ["batches"] alongside its own key.
          void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
          void queryClient.invalidateQueries({ queryKey: ["items"] });
          toast.success("Adjustment recorded");
          reset();
          onOpenChange(false);
        },
        onError: (error) => {
          let hadFieldError = false;
          for (const key of ["item_id", "quantity_before", "quantity_after", "reason"] as const) {
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
          <DialogTitle>New adjustment</DialogTitle>
          <DialogDescription>Correct a stock count -- always audited, never edits history.</DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item_id">Item</Label>
            <Controller
              control={control}
              name="item_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="item_id" className="w-full" aria-invalid={!!errors.item_id}>
                    <SelectValue>
                      {(v: string) => items?.results.find((i) => i.id === v)?.name ?? "Select item"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(items?.results ?? []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.item_id && <p className="text-xs text-destructive">{errors.item_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warehouse_id">Warehouse</Label>
              <Controller
                control={control}
                name="warehouse_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="warehouse_id" className="w-full" aria-invalid={!!errors.warehouse_id}>
                      <SelectValue>
                        {(v: string) => warehouses?.results.find((w) => w.id === v)?.name ?? "Select warehouse"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(warehouses?.results ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="house_id">House</Label>
              <Controller
                control={control}
                name="house_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="house_id" className="w-full">
                      <SelectValue>{(v: string) => houses?.results.find((h) => h.id === v)?.name ?? "None"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(houses?.results ?? []).map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          {errors.warehouse_id && <p className="-mt-2 text-xs text-destructive">{errors.warehouse_id.message}</p>}
          {currentBalance && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Current balance: {formatStock(currentBalance.balance, items?.results.find((i) => i.id === currentBalance.item_id) ?? { unit: currentBalance.unit })}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity_before">Quantity before</Label>
              <Input
                id="quantity_before"
                type="number"
                step="0.001"
                {...register("quantity_before")}
                aria-invalid={!!errors.quantity_before}
              />
              {errors.quantity_before && (
                <p className="text-xs text-destructive">{errors.quantity_before.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity_after">Quantity after</Label>
              <Input
                id="quantity_after"
                type="number"
                step="0.001"
                {...register("quantity_after")}
                aria-invalid={!!errors.quantity_after}
              />
              {errors.quantity_after && <p className="text-xs text-destructive">{errors.quantity_after.message}</p>}
            </div>
          </div>

          {delta !== null && !Number.isNaN(delta) && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Delta:{" "}
              <span className={cn("font-medium tabular-nums", delta > 0 ? "text-success" : "text-destructive")}>
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="reason" className="w-full" aria-invalid={!!errors.reason}>
                    <SelectValue>{(v: string) => v || "Select reason"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

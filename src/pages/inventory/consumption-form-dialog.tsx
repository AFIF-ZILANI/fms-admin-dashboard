import { Controller, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
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
import { NumericInput } from "@/components/utils/NumaricInput";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Item, LocationStockRow } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

// Local calendar day: toISOString() is UTC, which is still "yesterday" until 06:00 in Bangladesh.
const today = () => new Date().toLocaleDateString("en-CA");

const consumptionSchema = z.object({
  house_id: z.string().min(1, "Select a house"),
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Select a unit"),
  date: z.string().min(1, "Pick a date"),
  note: z.string().optional(),
});

type ConsumptionFormInput = z.input<typeof consumptionSchema>;
type ConsumptionFormValues = z.output<typeof consumptionSchema>;

type BatchHouseBalance = { batch_id: string; house_id: string; quantity: number; batch?: { batch_code: string } };

type ConsumptionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Feed (or any quantity-tracked item) used in a house -- the same draw the mobile "Log feed" form
 *  records. A QR-coded item is used one scanned unit at a time on mobile, so it isn't offered here. */
export function ConsumptionFormDialog({ open, onOpenChange }: ConsumptionFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ConsumptionFormInput, unknown, ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: { house_id: "", item_id: "", quantity: undefined, unit: "", date: today(), note: "" },
  });

  const houseId = useWatch({ control, name: "house_id" });
  const itemId = useWatch({ control, name: "item_id" });

  const { data: houses } = useGetData<Paginated<House>>("/houses?is_active=true&limit=100", ["houses", "active"]);
  // ponytail: the catalog list caps at 100, so the picker is built from the house's own stock rows; only
  // the coded items (few) are listed, to keep them out. Over 100 coded items, page this.
  const { data: codedItems } = useGetData<Paginated<Item>>("/items?is_unit_tracked=true&limit=100", [
    "items",
    "unit-tracked",
  ]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  // Only what is actually in the house: the server refuses a draw bigger than the house's stock.
  const { data: houseStock } = useGetData<LocationStockRow[]>(
    houseId ? `/houses/${houseId}/stock` : "",
    ["stock-at-location", "HOUSE", houseId],
    { enabled: !!houseId }
  );
  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    houseId ? `/batch-house-balances?house_id=${houseId}&limit=20` : "",
    ["batch-house-balances", "house", houseId],
    { enabled: !!houseId }
  );
  // The batch in the house when it was used -- the draw's cost lands on that batch.
  const batch = balances?.results.find((b) => b.quantity > 0);

  const coded = new Set((codedItems?.results ?? []).map((i) => i.id));
  const onHand = (houseStock ?? []).filter((s) => Number(s.balance) > 0 && !coded.has(s.item_id));
  const selectedStock = onHand.find((s) => s.item_id === itemId);
  // Fetched on its own for its usable unit conversions.
  const { data: selectedItem } = useGetData<Item>(itemId ? `/items/${itemId}` : "", ["items", itemId], {
    enabled: !!itemId,
  });
  const usableUnits = [
    ...(selectedItem ? [{ code: selectedItem.unit, label: unitLabel(selectedItem.unit) }] : []),
    ...(selectedItem?.itemUnits ?? []).filter((u) => u.is_usable).map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
  ];

  const queryClient = useQueryClient();
  const createConsumption = usePostData<unknown, Record<string, unknown>>("/consumptions", ["consumptions"]);

  const close = (next: boolean) => {
    if (!next) reset({ house_id: "", item_id: "", quantity: undefined, unit: "", date: today(), note: "" });
    onOpenChange(next);
  };

  const onSubmit = (values: ConsumptionFormValues) =>
    createConsumption.mutate(
      {
        house_id: values.house_id,
        item_id: values.item_id,
        quantity: values.quantity,
        unit: values.unit,
        // Noon local time, so the picked day doesn't shift across the UTC boundary.
        date: new Date(`${values.date}T12:00:00`).toISOString(),
        ...(batch && { batch_id: batch.batch_id }),
        ...(values.note?.trim() && { note: values.note.trim() }),
      },
      {
        onSuccess: () => {
          toast.success("Consumption recorded");
          void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
          void queryClient.invalidateQueries({ queryKey: ["stock-at-location"] });
          void queryClient.invalidateQueries({ queryKey: ["items"] });
          close(false);
        },
        onError: (error) => {
          const message = error.fieldError("quantity");
          if (message) setError("quantity", { message });
          else toast.error(error.message);
        },
      }
    );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record consumption</DialogTitle>
          <DialogDescription>
            Feed or supplies used in a house. It comes off that house's stock and is charged to the batch in it.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consumption-house">House</Label>
            <Controller
              control={control}
              name="house_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v ?? "");
                    setValue("item_id", "");
                    setValue("unit", "");
                  }}
                >
                  <SelectTrigger id="consumption-house" className="w-full" aria-invalid={!!errors.house_id}>
                    <SelectValue>
                      {(v: string) => houses?.results.find((h) => h.id === v)?.name ?? "Select house"}
                    </SelectValue>
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
            {errors.house_id && <p className="text-xs text-destructive">{errors.house_id.message}</p>}
            {houseId && (
              <p className="text-xs text-muted-foreground">
                {batch ? `Charged to batch ${batch.batch?.batch_code ?? ""}` : "No batch in this house — recorded without one."}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consumption-item">Item</Label>
            <Controller
              control={control}
              name="item_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={!houseId}
                  onValueChange={(v) => {
                    field.onChange(v ?? "");
                    setValue("unit", onHand.find((s) => s.item_id === v)?.unit ?? "");
                  }}
                >
                  <SelectTrigger id="consumption-item" className="w-full" aria-invalid={!!errors.item_id}>
                    <SelectValue>
                      {(v: string) =>
                        v ? (onHand.find((s) => s.item_id === v)?.item_name ?? "Item") : houseId ? "Select item" : "Pick a house first"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {onHand.map((s) => (
                      <SelectItem key={s.item_id} value={s.item_id}>
                        {s.item_name} · {Number(s.balance)} {unitLabel(s.unit).toLowerCase()} on hand
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.item_id && <p className="text-xs text-destructive">{errors.item_id.message}</p>}
            {houseId && houseStock && onHand.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nothing in this house to use — move stock here first (Stock ledger → Move stock).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consumption-quantity">Quantity</Label>
              <NumericInput
                id="consumption-quantity"
                allowDecimal
                decimalPlaces={3}
                placeholder="e.g. 50"
                {...register("quantity", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
                aria-invalid={!!errors.quantity}
              />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
              {selectedStock && (
                <p className="text-xs text-muted-foreground">
                  {Number(selectedStock.balance)} {unitLabel(selectedStock.unit).toLowerCase()} in this house
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consumption-unit">Unit</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} disabled={!selectedItem} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="consumption-unit" className="w-full" aria-invalid={!!errors.unit}>
                      <SelectValue>{(v: string) => (v ? unitLabel(v) : "Unit")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {usableUnits.map((u) => (
                        <SelectItem key={u.code} value={u.code}>
                          {u.label}
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
              <Label htmlFor="consumption-date">Date</Label>
              <Input id="consumption-date" type="date" max={today()} {...register("date")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consumption-note">Note (optional)</Label>
              <Input id="consumption-note" {...register("note")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Record consumption
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

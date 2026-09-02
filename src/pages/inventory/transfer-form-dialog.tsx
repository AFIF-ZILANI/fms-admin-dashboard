import { Controller, useForm, useWatch } from "react-hook-form";
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
import { LAST_ADMIN_KEY } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Item, Warehouse, LocationStockRow } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

type Admin = { id: string; profile: { id: string; name: string } };

type LocationOption = { value: string; type: "WAREHOUSE" | "HOUSE"; id: string; label: string };

// Combined value is "TYPE:id" -- a single string so it fits shadcn Select's value prop.
// Ids are UUIDs (no colons), so splitting on the first colon is unambiguous.
function parseLocation(value: string): { type: "WAREHOUSE" | "HOUSE"; id: string } {
  const [type, id] = value.split(":");
  return { type: type as "WAREHOUSE" | "HOUSE", id: id! };
}

const transferSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  from_location: z.string().min(1, "Select a source"),
  to_location: z.string().min(1, "Select a destination"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Select a unit"),
  note: z.string().optional(),
});

type TransferFormInput = z.input<typeof transferSchema>;
type TransferFormValues = z.output<typeof transferSchema>;

type TransferFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransferFormDialog({ open, onOpenChange }: TransferFormDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormInput, unknown, TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      item_id: "",
      from_location: "",
      to_location: "",
      quantity: undefined,
      unit: "",
      note: "",
    },
  });

  const { data: allItems } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  // Move Stock is the aggregate-quantity mechanism -- an item tracked by QR code belongs in Stock
  // Allocation instead, so it's excluded here (see is_unit_tracked on Item).
  const items = allItems?.results.filter((i) => !i.is_unit_tracked);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  const locationOptions: LocationOption[] = [
    ...(warehouses?.results ?? []).map((w) => ({
      value: `WAREHOUSE:${w.id}`,
      type: "WAREHOUSE" as const,
      id: w.id,
      label: `Warehouse — ${w.name}`,
    })),
    ...(houses?.results ?? []).map((h) => ({
      value: `HOUSE:${h.id}`,
      type: "HOUSE" as const,
      id: h.id,
      label: `House — ${h.name}`,
    })),
  ];

  const itemId = useWatch({ control, name: "item_id" });
  const fromLocation = useWatch({ control, name: "from_location" });
  const from = fromLocation ? parseLocation(fromLocation) : null;

  // A destination can't be the same place as the source, and warehouse->warehouse isn't a
  // supported move (mirrors TransferService's own two rejections server-side).
  const toOptions = locationOptions.filter((o) => {
    if (o.value === fromLocation) return false;
    if (from?.type === "WAREHOUSE" && o.type === "WAREHOUSE") return false;
    return true;
  });

  const selectedItem = items?.find((i) => i.id === itemId);
  const usableUnits = [
    ...(selectedItem ? [{ code: selectedItem.unit, label: unitLabel(selectedItem.unit) }] : []),
    ...(selectedItem?.itemUnits ?? [])
      .filter((u) => u.is_usable)
      .map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
  ];

  const { data: sourceStock } = useGetData<LocationStockRow[]>(
    from ? `/${from.type === "WAREHOUSE" ? "warehouses" : "houses"}/${from.id}/stock` : "",
    ["stock-at-location", from?.type ?? "", from?.id ?? ""],
    { enabled: !!from }
  );
  const availableAtSource = sourceStock?.find((s) => s.item_id === itemId);

  const queryClient = useQueryClient();
  const createTransfer = usePostData<unknown, Record<string, unknown>>("/stock-transfers", ["stock-ledger"]);

  const resolveRecordedBy = (): string | null => {
    const admin = admins?.results ?? [];
    const stored = localStorage.getItem(LAST_ADMIN_KEY);
    if (stored && admin.some((a) => a.profile.id === stored)) return stored;
    const fallback = admin[0]?.profile.id;
    if (fallback) localStorage.setItem(LAST_ADMIN_KEY, fallback);
    return fallback ?? null;
  };

  const onSubmit = (values: TransferFormValues) => {
    const recorded_by_id = resolveRecordedBy();
    if (!recorded_by_id) {
      toast.error("No admins exist yet — add one before recording a move.");
      return;
    }

    const fromParsed = parseLocation(values.from_location);
    const toParsed = parseLocation(values.to_location);

    createTransfer.mutate(
      {
        item_id: values.item_id,
        from_location_type: fromParsed.type,
        from_location_id: fromParsed.id,
        to_location_type: toParsed.type,
        to_location_id: toParsed.id,
        quantity: values.quantity,
        unit: values.unit,
        recorded_by_id,
        ...(values.note && { note: values.note }),
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
          void queryClient.invalidateQueries({ queryKey: ["items"] });
          void queryClient.invalidateQueries({ queryKey: ["warehouses"] });
          void queryClient.invalidateQueries({ queryKey: ["houses"] });
          void queryClient.invalidateQueries({ queryKey: ["stock-at-location"] });
          toast.success("Stock moved");
          reset();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move stock</DialogTitle>
          <DialogDescription>
            Move stock from a warehouse to a house, between houses, or back to a warehouse.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item_id">Item</Label>
            <Controller
              control={control}
              name="item_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue("unit", "");
                  }}
                >
                  <SelectTrigger id="item_id" className="w-full" aria-invalid={!!errors.item_id}>
                    <SelectValue>
                      {(v: string) => items?.find((i) => i.id === v)?.name ?? "Select item"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(items ?? []).map((item) => (
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex gap-2">
              <NumericInput
                id="quantity"
                allowDecimal
                decimalPlaces={3}
                className="flex-1"
                {...register("quantity")}
                aria-invalid={!!errors.quantity}
              />
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!selectedItem}>
                    <SelectTrigger className="w-32">
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
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_location">From</Label>
              <Controller
                control={control}
                name="from_location"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // A previously chosen destination might no longer be valid for the new source.
                      setValue("to_location", "");
                    }}
                  >
                    <SelectTrigger id="from_location" className="w-full" aria-invalid={!!errors.from_location}>
                      <SelectValue>
                        {(v: string) => locationOptions.find((o) => o.value === v)?.label ?? "Select source"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.from_location && (
                <p className="text-xs text-destructive">{errors.from_location.message}</p>
              )}
              {availableAtSource && (
                <p className="text-xs text-muted-foreground">
                  Available: {availableAtSource.balance} {availableAtSource.unit}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_location">To</Label>
              <Controller
                control={control}
                name="to_location"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!fromLocation}>
                    <SelectTrigger id="to_location" className="w-full" aria-invalid={!!errors.to_location}>
                      <SelectValue>
                        {(v: string) => locationOptions.find((o) => o.value === v)?.label ?? "Select destination"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {toOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.to_location && <p className="text-xs text-destructive">{errors.to_location.message}</p>}
            </div>
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
              Move stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

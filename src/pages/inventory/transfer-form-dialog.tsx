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

const transferSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  from_warehouse_id: z.string().min(1, "Select a warehouse"),
  to_house_id: z.string().min(1, "Select a house"),
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
      from_warehouse_id: "",
      to_house_id: "",
      quantity: undefined,
      unit: "",
      note: "",
    },
  });

  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: admins } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  const itemId = useWatch({ control, name: "item_id" });
  const fromWarehouseId = useWatch({ control, name: "from_warehouse_id" });

  const selectedItem = items?.results.find((i) => i.id === itemId);
  const usableUnits = [
    ...(selectedItem ? [{ code: selectedItem.unit, label: unitLabel(selectedItem.unit) }] : []),
    ...(selectedItem?.itemUnits ?? [])
      .filter((u) => u.is_usable)
      .map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
  ];

  const { data: warehouseStock } = useGetData<LocationStockRow[]>(
    `/warehouses/${fromWarehouseId}/stock`,
    ["warehouses", fromWarehouseId, "stock"],
    { enabled: !!fromWarehouseId }
  );
  const availableAtWarehouse = warehouseStock?.find((s) => s.item_id === itemId);

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
      toast.error("No admins exist yet — add one before recording a transfer.");
      return;
    }

    createTransfer.mutate(
      {
        item_id: values.item_id,
        from_warehouse_id: values.from_warehouse_id,
        to_house_id: values.to_house_id,
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
          toast.success("Stock transferred");
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
          <DialogTitle>Transfer to house</DialogTitle>
          <DialogDescription>Move stock from a warehouse to a house, before it's used.</DialogDescription>
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
              <Label htmlFor="from_warehouse_id">From warehouse</Label>
              <Controller
                control={control}
                name="from_warehouse_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="from_warehouse_id"
                      className="w-full"
                      aria-invalid={!!errors.from_warehouse_id}
                    >
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
              {errors.from_warehouse_id && (
                <p className="text-xs text-destructive">{errors.from_warehouse_id.message}</p>
              )}
              {availableAtWarehouse && (
                <p className="text-xs text-muted-foreground">
                  Available: {availableAtWarehouse.balance} {availableAtWarehouse.unit}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_house_id">To house</Label>
              <Controller
                control={control}
                name="to_house_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="to_house_id" className="w-full" aria-invalid={!!errors.to_house_id}>
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
              {errors.to_house_id && <p className="text-xs text-destructive">{errors.to_house_id.message}</p>}
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
              Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

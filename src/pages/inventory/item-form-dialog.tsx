import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { useDelete, useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import type { Item, ItemUnit, Organization } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

type PendingUnit = { unit: string; factor_to_base: string };

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().min(1, "Select a category"),
  unit: z.string().min(1, "Select a unit"),
  reorder_level: optionalNumber(z.coerce.number().nonnegative("Must be 0 or more")),
  preferred_reorder_qty: optionalNumber(z.coerce.number().nonnegative("Must be 0 or more")),
  lead_time_days: optionalNumber(z.coerce.number().int().nonnegative("Must be 0 or more")),
  organization_id: z.string().optional(),
});

// z.coerce fields make the schema's input type (raw form values) differ from
// its output type (parsed payload) — RHF's 3rd generic carries that through (same pattern as Houses).
type ItemFormInput = z.input<typeof itemSchema>;
type ItemFormValues = z.output<typeof itemSchema>;

type ItemFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item;
};

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const isEdit = Boolean(item);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormInput, unknown, ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      category: undefined,
      unit: undefined,
      reorder_level: "",
      preferred_reorder_qty: "",
      lead_time_days: "",
      organization_id: "",
    },
  });

  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>([]);
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitFactor, setNewUnitFactor] = useState("");

  // Resets the form + local unit state whenever the dialog transitions into an open state (for this
  // item, or fresh for "add"). Adjusted during render rather than in a useEffect, per React's own
  // "reset state on prop change" pattern — avoids the cascading-render setState-in-effect it'd otherwise be.
  const resetKey = open ? (item?.id ?? "__new__") : null;
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (resetKey !== null) {
      reset(
        item
          ? {
              name: item.name,
              category: item.category,
              unit: item.unit,
              reorder_level: item.reorder_level ?? "",
              preferred_reorder_qty: item.preferred_reorder_qty ?? "",
              lead_time_days: item.lead_time_days ?? "",
              // can't prefill — GET /items/:id doesn't return existing organization links (docs/api.md §6.1)
              organization_id: "",
            }
          : {
              name: "",
              category: undefined,
              unit: undefined,
              reorder_level: "",
              preferred_reorder_qty: "",
              lead_time_days: "",
              organization_id: "",
            }
      );
      setPendingUnits((item?.itemUnits ?? []).map((u) => ({ unit: u.unit, factor_to_base: u.factor_to_base })));
      setNewUnitCode("");
      setNewUnitFactor("");
    }
  }

  const createItem = usePostData<Item, ItemFormValues>("/items", ["items"]);
  const updateItem = usePatchData<Item, ItemFormValues>(`/items/${item?.id}`, ["items"]);
  const mutation = isEdit ? updateItem : createItem;

  const { data: organizations } = useGetData<Paginated<Organization>>("/organizations?limit=100", [
    "organizations",
  ]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/item-categories?active=true&limit=100",
    ["item-categories", "active"]
  );
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const linkOrganization = usePostData<unknown, { item_id: string; organization_id: string; role: string }>(
    "/item-organizations",
    ["organizations"]
  );
  const createItemUnit = usePostData<ItemUnit, { item_id: string; unit: string; factor_to_base: number }>(
    "/item-units",
    ["items"]
  );
  const deleteItemUnit = useDelete<null, string>((id) => `/item-units/${id}`, ["items"]);

  const baseUnit = useWatch({ control, name: "unit" });
  const usedUnitCodes = new Set([baseUnit, ...pendingUnits.map((u) => u.unit)]);
  const addableUnits = (units?.results ?? []).filter((u) => !usedUnitCodes.has(u.code));
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  const addPendingUnit = () => {
    const factor = Number(newUnitFactor);
    if (!newUnitCode || !Number.isFinite(factor) || factor <= 0) return;
    setPendingUnits((prev) => [...prev, { unit: newUnitCode, factor_to_base: newUnitFactor }]);
    setNewUnitCode("");
    setNewUnitFactor("");
  };

  /** No PATCH on ItemUnit -- a changed factor is a delete-then-recreate of that unit's row, same as an untouched
   * removal. Deletes run first so a re-added unit doesn't collide with the row it's replacing (item_id+unit is unique). */
  async function syncItemUnits(itemId: string) {
    const original = item?.itemUnits ?? [];
    const toRemove = original.filter((o) => {
      const kept = pendingUnits.find((p) => p.unit === o.unit);
      return !kept || kept.factor_to_base !== o.factor_to_base;
    });
    const toAdd = pendingUnits.filter((p) => {
      const orig = original.find((o) => o.unit === p.unit);
      return !orig || orig.factor_to_base !== p.factor_to_base;
    });
    for (const row of toRemove) {
      await deleteItemUnit.mutateAsync(row.id);
    }
    for (const row of toAdd) {
      await createItemUnit.mutateAsync({ item_id: itemId, unit: row.unit, factor_to_base: Number(row.factor_to_base) });
    }
  }

  const onSubmit = (values: ItemFormValues) => {
    const { organization_id, ...payload } = values;
    mutation.mutate(payload, {
      onSuccess: (savedItem) => {
        toast.success(isEdit ? "Item updated" : "Item created");
        void syncItemUnits(savedItem.id).catch(() => {
          toast.warning("Item saved, but updating its purchasable units failed. Try again from Edit.");
        });
        if (!organization_id) {
          onOpenChange(false);
          return;
        }
        linkOrganization.mutate(
          { item_id: savedItem.id, organization_id, role: "MANUFACTURER" },
          {
            onSuccess: () => onOpenChange(false),
            onError: (error) => {
              toast.warning(
                error.status === 409
                  ? "Item saved, but it's already linked to that organization."
                  : `Item saved, but linking the organization failed: ${error.message}`
              );
              onOpenChange(false);
            },
          }
        );
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "category", "unit", "reorder_level", "preferred_reorder_qty", "lead_time_days"] as const) {
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
          <DialogTitle>{isEdit ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this catalog item." : "Add a new item to the catalog."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Starter Feed" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                      <SelectValue>
                        {(value: string) =>
                          value
                            ? (categories?.results.find((cat) => cat.code === value)?.label ?? humanizeEnum(value))
                            : "Select category"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(categories?.results ?? []).map((cat) => (
                        <SelectItem key={cat.code} value={cat.code}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="unit" className="w-full" aria-invalid={!!errors.unit}>
                      <SelectValue>
                        {(value: string) =>
                          value
                            ? (units?.results.find((u) => u.code === value)?.label ?? humanizeEnum(value))
                            : "Select unit"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(units?.results ?? []).map((unit) => (
                        <SelectItem key={unit.code} value={unit.code}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
            </div>
          </div>

          <p className="-mt-2 text-xs text-muted-foreground">
            Use the unit you dispense in (e.g. G, ML) as the base unit below.
          </p>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label>Purchasable units</Label>
              <p className="text-xs text-muted-foreground">
                Which units this item can be purchased in, and how each converts to the base unit above. Purchases
                will only offer these units — e.g. Feed: base KG, plus BAG = 50 and MT = 1000.
              </p>
            </div>

            {baseUnit && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
                <span>{unitLabel(baseUnit)}</span>
                <span className="text-xs text-muted-foreground">base unit · always available</span>
              </div>
            )}

            {pendingUnits.map((row, index) => (
              <div key={row.unit} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{unitLabel(row.unit)}</span>
                <span className="text-xs text-muted-foreground">1 {unitLabel(row.unit)} =</span>
                <Input
                  type="number"
                  step="0.0001"
                  className="w-28"
                  value={row.factor_to_base}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPendingUnits((prev) => prev.map((p, i) => (i === index ? { ...p, factor_to_base: value } : p)));
                  }}
                />
                <span className="text-xs text-muted-foreground">{baseUnit ? unitLabel(baseUnit) : ""}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${unitLabel(row.unit)}`}
                  onClick={() => setPendingUnits((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Select value={newUnitCode} onValueChange={(v) => setNewUnitCode(v ?? "")}>
                <SelectTrigger className="w-40">
                  <SelectValue>{(v: string) => (v ? unitLabel(v) : "Add a unit")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {addableUnits.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">factor =</span>
              <Input
                type="number"
                step="0.0001"
                placeholder="e.g. 50"
                className="w-28"
                value={newUnitFactor}
                onChange={(e) => setNewUnitFactor(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" onClick={addPendingUnit} disabled={!newUnitCode}>
                <Plus />
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organization_id">Organization / company (optional)</Label>
            <Controller
              control={control}
              name="organization_id"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="organization_id" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        organizations?.results.find((org) => org.id === value)?.label_name ?? "Select organization"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(organizations?.results ?? []).map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.label_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {(organizations?.results ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No organizations yet — add one in the Organizations tab.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reorder_level">Reorder level (optional)</Label>
              <Input id="reorder_level" type="number" step="0.001" {...register("reorder_level")} />
              {errors.reorder_level && <p className="text-xs text-destructive">{errors.reorder_level.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferred_reorder_qty">Reorder qty (optional)</Label>
              <Input id="preferred_reorder_qty" type="number" step="0.001" {...register("preferred_reorder_qty")} />
              {errors.preferred_reorder_qty && (
                <p className="text-xs text-destructive">{errors.preferred_reorder_qty.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead_time_days">Lead time in days (optional)</Label>
            <Input id="lead_time_days" type="number" step="1" {...register("lead_time_days")} />
            {errors.lead_time_days && <p className="text-xs text-destructive">{errors.lead_time_days.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

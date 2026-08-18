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
import { useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import type { Item, Organization } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

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

  useEffect(() => {
    if (open) {
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
    }
  }, [open, item, reset]);

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

  const onSubmit = (values: ItemFormValues) => {
    const { organization_id, ...payload } = values;
    mutation.mutate(payload, {
      onSuccess: (savedItem) => {
        toast.success(isEdit ? "Item updated" : "Item created");
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
            Use the unit you dispense in (e.g. G, ML), not the bulk buying unit — no auto-conversion yet.
          </p>

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

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumericInput } from "@/components/utils/NumaricInput";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useDelete, useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import { GENERIC_ITEM_UNITS, type Item, type ItemUnit, type Organization, type UnitRow } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

type PendingUnit = { unit: string; factor_to_base: string; is_purchasable: boolean; is_usable: boolean };
type MetaRow = { key: string; value: string };

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  category: z.string().min(1, "Select a category"),
  unit: z.string().min(1, "Select a unit"),
  lead_time_days: optionalNumber(z.coerce.number().int().nonnegative("Must be 0 or more")),
  organization_id: z.string().optional(),
  is_unit_tracked: z.boolean(),
});

// z.coerce fields make the schema's input type (raw form values) differ from
// its output type (parsed payload) — RHF's 3rd generic carries that through (same pattern as Purchases).
type ItemFormInput = z.input<typeof itemSchema>;
type ItemFormValues = z.output<typeof itemSchema>;

export function ItemFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  usePageTitle(isEdit ? "Edit item" : "Add item");

  const { data: item } = useGetData<Item>(`/items/${id}`, ["items", id ?? ""], { enabled: isEdit });

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
      lead_time_days: "",
      organization_id: "",
      is_unit_tracked: false,
    },
  });

  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>([]);
  const [newUnitCode, setNewUnitCode] = useState("");
  const [newUnitFactor, setNewUnitFactor] = useState("");
  const [newUnitPurchasable, setNewUnitPurchasable] = useState(true);
  const [newUnitUsable, setNewUnitUsable] = useState(false);
  const [reorderUnit, setReorderUnit] = useState("");
  const [reorderValue, setReorderValue] = useState("");
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [metaRows, setMetaRows] = useState<MetaRow[]>([]);

  // Loads the item's data into the form + local state once it arrives (edit), or resets to blank
  // (add). Adjusted during render rather than in a useEffect, per React's own "reset state on prop
  // change" pattern — this page component doesn't remount between /items/new and /items/:id/edit.
  const resetKey = isEdit ? (item ? item.id : null) : "__new__";
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey !== null && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (item) {
      reset({
        name: item.name,
        category: item.category,
        unit: item.unit,
        lead_time_days: item.lead_time_days ?? "",
        // can't prefill — GET /items/:id doesn't return existing organization links (docs/api.md §6.1)
        organization_id: "",
        is_unit_tracked: item.is_unit_tracked,
      });
      setPendingUnits(
        (item.itemUnits ?? []).map((u) => ({
          unit: u.unit,
          factor_to_base: u.factor_to_base,
          is_purchasable: u.is_purchasable,
          is_usable: u.is_usable,
        }))
      );
      setReorderUnit(item.unit);
      setReorderValue(item.reorder_level ?? "");
      setMetaRows(Object.entries(item.meta_data ?? {}).map(([key, value]) => ({ key, value })));
    } else {
      reset({
        name: "",
        category: undefined,
        unit: undefined,
        lead_time_days: "",
        organization_id: "",
        is_unit_tracked: false,
      });
      setPendingUnits([]);
      setReorderUnit("");
      setReorderValue("");
      setMetaRows([]);
    }
  }

  const { data: organizations } = useGetData<Paginated<Organization>>("/organizations?limit=100", [
    "organizations",
  ]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/item-categories?active=true&limit=100",
    ["item-categories", "active"]
  );
  const { data: units } = useGetData<Paginated<UnitRow>>("/units?active=true&limit=100", ["units", "active"]);

  const createItem = usePostData<Item, Record<string, unknown>>("/items", ["items"]);
  const updateItem = usePatchData<Item, Record<string, unknown>>(`/items/${id}`, ["items"]);
  const mutation = isEdit ? updateItem : createItem;
  const linkOrganization = usePostData<unknown, { item_id: string; organization_id: string; role: string }>(
    "/item-organizations",
    ["organizations"]
  );
  const createItemUnit = usePostData<
    ItemUnit,
    { item_id: string; unit: string; factor_to_base: number; is_purchasable: boolean; is_usable: boolean }
  >("/item-units", ["items"]);
  const deleteItemUnit = useDelete<null, string>((unitId) => `/item-units/${unitId}`, ["items"]);

  const baseUnit = useWatch({ control, name: "unit" });
  const usedUnitCodes = new Set([baseUnit, ...pendingUnits.map((u) => u.unit)]);
  // A unit belongs to this item's base-unit family if it's tied to that specific base (LITER -> ML)
  // or generic across every family (Container, null base_unit) -- never one of the 6 bases itself,
  // and never a unit tied to a different family (LITER can't convert a Gram-based item).
  const addableUnits = (units?.results ?? []).filter(
    (u) => !usedUnitCodes.has(u.code) && !u.is_base && (u.base_unit === baseUnit || GENERIC_ITEM_UNITS.has(u.code))
  );
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);
  const unitFixedFactor = (code: string) => units?.results.find((u) => u.code === code)?.fixed_factor ?? null;

  const addPendingUnit = () => {
    const factor = Number(newUnitFactor);
    if (!newUnitCode || !Number.isFinite(factor) || factor <= 0) return;
    if (!newUnitPurchasable && !newUnitUsable) return;
    setPendingUnits((prev) => [
      ...prev,
      { unit: newUnitCode, factor_to_base: newUnitFactor, is_purchasable: newUnitPurchasable, is_usable: newUnitUsable },
    ]);
    setNewUnitCode("");
    setNewUnitFactor("");
    setNewUnitPurchasable(true);
    setNewUnitUsable(false);
  };

  /** No PATCH on ItemUnit -- a changed factor or purpose flag is a delete-then-recreate of that
   * unit's row, same as an untouched removal. Deletes run first so a re-added unit doesn't collide
   * with the row it's replacing (item_id+unit is unique). */
  async function syncItemUnits(itemId: string) {
    const original = item?.itemUnits ?? [];
    const changed = (o: ItemUnit, p: PendingUnit) =>
      p.factor_to_base !== o.factor_to_base || p.is_purchasable !== o.is_purchasable || p.is_usable !== o.is_usable;
    const toRemove = original.filter((o) => {
      const kept = pendingUnits.find((p) => p.unit === o.unit);
      return !kept || changed(o, kept);
    });
    const toAdd = pendingUnits.filter((p) => {
      const orig = original.find((o) => o.unit === p.unit);
      return !orig || changed(orig, p);
    });
    for (const row of toRemove) {
      await deleteItemUnit.mutateAsync(row.id);
    }
    for (const row of toAdd) {
      await createItemUnit.mutateAsync({
        item_id: itemId,
        unit: row.unit,
        factor_to_base: Number(row.factor_to_base),
        is_purchasable: row.is_purchasable,
        is_usable: row.is_usable,
      });
    }
  }

  // Reorder level is entered in whichever purchasable unit is convenient, then converted to the
  // item's base unit for storage -- Item.reorder_level has always been in base-unit terms.
  const purchasableUnits = [
    ...(baseUnit ? [{ code: baseUnit, label: unitLabel(baseUnit) }] : []),
    ...pendingUnits.filter((u) => u.is_purchasable).map((u) => ({ code: u.unit, label: unitLabel(u.unit) })),
  ];
  const reorderUnitValue = purchasableUnits.some((u) => u.code === reorderUnit) ? reorderUnit : (baseUnit ?? "");

  const addMetaRow = () => setMetaRows((prev) => [...prev, { key: "", value: "" }]);
  const buildMetaData = (): Record<string, string> | undefined => {
    const entries = metaRows
      .filter((r) => r.key.trim() !== "")
      .map((r) => [r.key.trim(), r.value] as const);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const onSubmit = (values: ItemFormValues) => {
    setReorderError(null);
    const reorderFactor =
      reorderUnitValue === baseUnit
        ? 1
        : Number(pendingUnits.find((u) => u.unit === reorderUnitValue)?.factor_to_base ?? 1);
    let reorder_level: number | undefined;
    if (reorderValue !== "") {
      const raw = Number(reorderValue);
      if (!Number.isFinite(raw) || raw < 0) {
        setReorderError("Enter a valid reorder level.");
        return;
      }
      reorder_level = raw * reorderFactor;
    }

    const { organization_id, unit, ...rest } = values;
    const payload: Record<string, unknown> = {
      ...rest,
      ...(!isEdit && { unit }),
      reorder_level,
      meta_data: buildMetaData(),
    };

    mutation.mutate(payload, {
      onSuccess: (savedItem) => {
        toast.success(isEdit ? "Item updated" : "Item created");
        void syncItemUnits(savedItem.id).catch(() => {
          toast.warning("Item saved, but updating its units failed. Try again from Edit.");
        });
        if (!organization_id) {
          navigate("/inventory?tab=items");
          return;
        }
        linkOrganization.mutate(
          { item_id: savedItem.id, organization_id, role: "MANUFACTURER" },
          {
            onSuccess: () => navigate("/inventory?tab=items"),
            onError: (error) => {
              toast.warning(
                error.status === 409
                  ? "Item saved, but it's already linked to that organization."
                  : `Item saved, but linking the organization failed: ${error.message}`
              );
              navigate("/inventory?tab=items");
            },
          }
        );
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "category", "unit", "lead_time_days"] as const) {
          const message = error.fieldError(key);
          if (message) {
            setError(key, { message });
            hadFieldError = true;
          }
        }
        const reorderMessage = error.fieldError("reorder_level");
        if (reorderMessage) {
          setReorderError(reorderMessage);
          hadFieldError = true;
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  if (isEdit && !item) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/inventory?tab=items")}>
          <ArrowLeft />
          Back to inventory
        </Button>
        <p className="text-sm text-muted-foreground">Loading item…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/inventory?tab=items")}>
        <ArrowLeft />
        Back to inventory
      </Button>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Item details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                <Label htmlFor="unit">Base unit</Label>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isEdit}>
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
                        {(units?.results ?? [])
                          .filter((u) => u.is_base)
                          .map((unitOption) => (
                            <SelectItem key={unitOption.code} value={unitOption.code}>
                              {unitOption.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
                <p className="text-xs text-muted-foreground">
                  {isEdit
                    ? "Can't be changed after the item is created."
                    : "One of the 6 canonical base units — every purchasable/usable unit below converts to this."}
                </p>
              </div>
            </div>

            <Controller
              control={control}
              name="is_unit_tracked"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
                  Tracked by QR code (medicine, vaccine, equipment)
                </label>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Checked: this item is bound to individual QR-coded units (Bind Code, Stock
              Allocation). Unchecked: tracked only as an aggregate quantity (Move Stock). An item
              can only use one of the two.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unit conversions</CardTitle>
            <p className="text-xs text-muted-foreground">
              Only units belonging to this item's base-unit family are offered — e.g. a Gram-based item can add
              Bag or Metric Ton, but not Liter. A unit with a fixed conversion (like Liter or Metric Ton) has its
              factor locked in automatically; package-size units (Bag, Bottle, Container) stay editable.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {baseUnit && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm">
                <span>{unitLabel(baseUnit)}</span>
                <span className="text-xs text-muted-foreground">base unit · always purchasable &amp; usable</span>
              </div>
            )}

            {pendingUnits.map((row, index) => {
              const fixedFactor = unitFixedFactor(row.unit);
              return (
              <div key={row.unit} className="flex items-center gap-3">
                <span className="w-24 text-sm">{unitLabel(row.unit)}</span>
                <span className="text-xs text-muted-foreground">1 {unitLabel(row.unit)} =</span>
                <NumericInput
                  allowDecimal
                  decimalPlaces={4}
                  className="w-24"
                  disabled={fixedFactor !== null}
                  value={fixedFactor ?? row.factor_to_base}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPendingUnits((prev) => prev.map((p, i) => (i === index ? { ...p, factor_to_base: value } : p)));
                  }}
                />
                <span className="text-xs text-muted-foreground">{baseUnit ? unitLabel(baseUnit) : ""}</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={row.is_purchasable}
                    onCheckedChange={(checked) =>
                      setPendingUnits((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, is_purchasable: Boolean(checked) } : p))
                      )
                    }
                  />
                  Purchasable
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={row.is_usable}
                    onCheckedChange={(checked) =>
                      setPendingUnits((prev) =>
                        prev.map((p, i) => (i === index ? { ...p, is_usable: Boolean(checked) } : p))
                      )
                    }
                  />
                  Usable
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={`Remove ${unitLabel(row.unit)}`}
                  onClick={() => setPendingUnits((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={newUnitCode}
                onValueChange={(v) => {
                  const code = v ?? "";
                  setNewUnitCode(code);
                  const fixed = unitFixedFactor(code);
                  if (fixed !== null) setNewUnitFactor(fixed);
                }}
              >
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
              <NumericInput
                allowDecimal
                decimalPlaces={4}
                placeholder="e.g. 50"
                className="w-24"
                disabled={unitFixedFactor(newUnitCode) !== null}
                value={newUnitFactor}
                onChange={(e) => setNewUnitFactor(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={newUnitPurchasable} onCheckedChange={(c) => setNewUnitPurchasable(Boolean(c))} />
                Purchasable
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={newUnitUsable} onCheckedChange={(c) => setNewUnitUsable(Boolean(c))} />
                Usable
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPendingUnit}
                disabled={!newUnitCode || (!newUnitPurchasable && !newUnitUsable)}
              >
                <Plus />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company / manufacturer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organization_id">Manufacturer (optional)</Label>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reorder &amp; lead time</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Reorder level (optional)</Label>
              <div className="flex gap-2">
                <NumericInput
                  allowDecimal
                  decimalPlaces={3}
                  className="flex-1"
                  value={reorderValue}
                  onChange={(e) => setReorderValue(e.target.value)}
                />
                <Select value={reorderUnitValue} onValueChange={(v) => setReorderUnit(v ?? "")}>
                  <SelectTrigger className="w-32">
                    <SelectValue>{(v: string) => (v ? unitLabel(v) : "Unit")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {purchasableUnits.map((u) => (
                      <SelectItem key={u.code} value={u.code}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {reorderError && <p className="text-xs text-destructive">{reorderError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead_time_days">Lead time in days (optional)</Label>
              <Input id="lead_time_days" type="number" step="1" {...register("lead_time_days")} />
              {errors.lead_time_days && <p className="text-xs text-destructive">{errors.lead_time_days.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Metadata</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addMetaRow}>
              <Plus />
              Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {metaRows.length === 0 && (
              <p className="text-xs text-muted-foreground">Optional key/value pairs for anything else worth tracking on this item.</p>
            )}
            {metaRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="KEY"
                  className="w-48 font-mono uppercase"
                  value={row.key}
                  onChange={(e) =>
                    setMetaRows((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, key: e.target.value.toUpperCase() } : r))
                    )
                  }
                />
                <Input
                  placeholder="value"
                  className="flex-1 font-mono"
                  value={row.value}
                  onChange={(e) =>
                    setMetaRows((prev) => prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove metadata row"
                  onClick={() => setMetaRows((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/inventory?tab=items")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isEdit ? "Save changes" : "Create item"}
          </Button>
        </div>
      </form>
    </div>
  );
}

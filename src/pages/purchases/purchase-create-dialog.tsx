import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { Plus, Trash2 } from "lucide-react";
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
import type { Item } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import type { Supplier } from "@/pages/suppliers/types";
import type { Purchase } from "@/pages/purchases/types";
import { BindCodesPrompt } from "@/pages/purchases/bind-codes-prompt";

// ponytail: these are live ItemCategory.code values a user can rename via
// Settings, which silently breaks this "show bind-codes prompt" check with
// no error -- needs a stable-key mechanism (e.g. an is_system flag) if
// renaming these specific categories becomes a real risk.
const CODED_CATEGORIES = ["MEDICINE", "VACCINE", "EQUIPMENT"];

const lineSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  batch_id: z.string().optional(),
  quantity: z.coerce.number().positive("Must be positive"),
  unit: z.string().min(1, "Select a unit"),
  unit_price: z.coerce.number().positive("Must be positive"),
  mfg_date: z.string().optional(),
  expiration_date: z.string().optional(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().optional(),
  invoice_no: z.string().trim().optional(),
  purchase_date: z.string().min(1, "Purchase date is required"),
  paid_amount: optionalNumber(z.coerce.number().nonnegative("Must be 0 or more")),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type PurchaseFormInput = z.input<typeof purchaseSchema>;
type PurchaseFormValues = z.output<typeof purchaseSchema>;

function blankLine(): PurchaseFormInput["items"][number] {
  return {
    item_id: "",
    batch_id: "",
    quantity: undefined,
    // useFieldArray's append() wants the exact item type, unlike useForm's
    // lenient DeepPartial defaultValues — cast the "nothing selected" state through.
    unit: undefined as unknown as PurchaseFormInput["items"][number]["unit"],
    unit_price: undefined,
    mfg_date: "",
    expiration_date: "",
  };
}

function blankPurchase() {
  return {
    supplier_id: "",
    invoice_no: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    paid_amount: "",
    recorded_by_id: "",
    items: [blankLine()],
  };
}

type PurchaseCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function PurchaseCreateDialog({ open, onOpenChange }: PurchaseCreateDialogProps) {
  const navigate = useNavigate();
  const [bindPromptPurchase, setBindPromptPurchase] = useState<Purchase | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: blankPurchase(),
  });

  // Dialog stays mounted between opens — without this, reopening after a
  // cancel (or a successful submit that didn't unmount) would show stale values.
  useEffect(() => {
    if (open) reset(blankPurchase());
  }, [open, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);

  const createPurchase = usePostData<Purchase, PurchaseFormValues>("/purchases", ["purchases"]);

  const itemOptions = items?.results ?? [];
  const totalPreview = (watchedItems ?? []).reduce((sum, line) => {
    const qty = Number(line?.quantity) || 0;
    const price = Number(line?.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = (values: PurchaseFormValues) => {
    const payload = {
      ...values,
      supplier_id: values.supplier_id || undefined,
      invoice_no: values.invoice_no || undefined,
      items: values.items.map((line) => ({
        ...line,
        batch_id: line.batch_id || undefined,
        mfg_date: line.mfg_date || undefined,
        expiration_date: line.expiration_date || undefined,
      })),
    };
    createPurchase.mutate(payload, {
      onSuccess: (purchase) => {
        toast.success("Purchase recorded");
        onOpenChange(false);
        const hasCodedItems = purchase.items.some((line) => CODED_CATEGORIES.includes(line.item.category));
        if (hasCodedItems) {
          setBindPromptPurchase(purchase);
        } else {
          navigate(`/purchases/${purchase.id}`);
        }
      },
      onError: (error) => {
        const message =
          error.fieldError("purchase_date") ?? error.fieldError("recorded_by_id") ?? error.fieldError("paid_amount");
        toast.error(message ?? error.message);
      },
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record purchase</DialogTitle>
          <DialogDescription>Line totals and the purchase total are computed automatically.</DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier_id">Supplier (optional)</Label>
              <Controller
                control={control}
                name="supplier_id"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="supplier_id" className="w-full">
                      <SelectValue>
                        {(v: string) => suppliers?.results.find((s) => s.id === v)?.profile.name ?? "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers?.results ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.profile.name}
                          {s.company ? ` (${s.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice_no">Invoice number (optional)</Label>
              <Input id="invoice_no" {...register("invoice_no")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid_amount">Paid amount (optional, default 0)</Label>
              <Input id="paid_amount" type="number" step="0.01" {...register("paid_amount")} />
              {errors.paid_amount && <p className="text-xs text-destructive">{errors.paid_amount.message}</p>}
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

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append(blankLine())}>
                <Plus />
                Add line
              </Button>
            </div>
            {errors.items?.root && <p className="text-xs text-destructive">{errors.items.root.message}</p>}

            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Controller
                    control={control}
                    name={`items.${index}.item_id`}
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={f.onChange}>
                        <SelectTrigger className="w-full" aria-invalid={!!errors.items?.[index]?.item_id}>
                          <SelectValue>
                            {(v: string) => itemOptions.find((i) => i.id === v)?.name ?? "Select item"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {itemOptions.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.unit`}
                    render={({ field: f }) => (
                      <Select value={f.value ?? ""} onValueChange={f.onChange}>
                        <SelectTrigger className="w-full" aria-invalid={!!errors.items?.[index]?.unit}>
                          <SelectValue>
                            {(v: string) =>
                              v ? (units?.results.find((u) => u.code === v)?.label ?? v) : "Select unit"
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
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Quantity"
                    aria-invalid={!!errors.items?.[index]?.quantity}
                    {...register(`items.${index}.quantity`)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Unit price"
                    aria-invalid={!!errors.items?.[index]?.unit_price}
                    {...register(`items.${index}.unit_price`)}
                  />
                  <div className="flex items-center justify-end px-2 text-sm tabular-nums text-muted-foreground">
                    ={" "}
                    {formatMoney(
                      (Number(watchedItems?.[index]?.quantity) || 0) *
                        (Number(watchedItems?.[index]?.unit_price) || 0)
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Mfg date (optional)</Label>
                    <Input type="date" {...register(`items.${index}.mfg_date`)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Expiration date (optional)</Label>
                    <Input type="date" {...register(`items.${index}.expiration_date`)} />
                  </div>
                </div>

                {(() => {
                  const lineErrors = errors.items?.[index];
                  const message =
                    lineErrors?.item_id?.message ??
                    lineErrors?.unit?.message ??
                    lineErrors?.quantity?.message ??
                    lineErrors?.unit_price?.message;
                  return message ? <p className="text-xs text-destructive">{message}</p> : null;
                })()}

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                    Remove line
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end text-sm font-medium tabular-nums">
            Total: {formatMoney(totalPreview)}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Record purchase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

      <BindCodesPrompt
        purchase={bindPromptPurchase}
        onDone={() => {
          if (bindPromptPurchase) navigate(`/purchases/${bindPromptPurchase.id}`);
          setBindPromptPurchase(null);
        }}
      />
    </>
  );
}

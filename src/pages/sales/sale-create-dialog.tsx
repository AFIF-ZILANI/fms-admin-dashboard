import { useEffect } from "react";
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
import { UNITS, type Item } from "@/pages/inventory/types";
import type { Customer } from "@/pages/customers/types";
import type { Sale } from "@/pages/sales/types";

const lineSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Must be positive"),
  unit: z.enum(UNITS, "Select a unit"),
  unit_price: z.coerce.number().positive("Must be positive"),
});

const saleSchema = z.object({
  customer_id: z.string().optional(),
  sale_date: z.string().min(1, "Sale date is required"),
  paid_amount: optionalNumber(z.coerce.number().nonnegative("Must be 0 or more")),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type SaleFormInput = z.input<typeof saleSchema>;
type SaleFormValues = z.output<typeof saleSchema>;

function blankLine(): SaleFormInput["items"][number] {
  return {
    item_id: "",
    quantity: undefined,
    unit: undefined as unknown as SaleFormInput["items"][number]["unit"],
    unit_price: undefined,
  };
}

function blankSale(): SaleFormInput {
  return {
    customer_id: "",
    sale_date: new Date().toISOString().slice(0, 10),
    paid_amount: "",
    recorded_by_id: "",
    items: [blankLine()],
  };
}

type SaleCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function SaleCreateDialog({ open, onOpenChange }: SaleCreateDialogProps) {
  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormInput, unknown, SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: blankSale(),
  });

  useEffect(() => {
    if (open) reset(blankSale());
  }, [open, reset]);

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = useWatch({ control, name: "items" });

  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);

  const createSale = usePostData<Sale, SaleFormValues>("/sales", ["sales"]);

  const itemOptions = items?.results ?? [];
  const totalPreview = (watchedItems ?? []).reduce((sum, line) => {
    const qty = Number(line?.quantity) || 0;
    const price = Number(line?.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = (values: SaleFormValues) => {
    const payload = {
      ...values,
      customer_id: values.customer_id || undefined,
    };
    createSale.mutate(payload, {
      onSuccess: (sale) => {
        toast.success("Sale recorded");
        onOpenChange(false);
        navigate(`/sales/${sale.id}`);
      },
      onError: (error) => {
        const message =
          error.fieldError("sale_date") ?? error.fieldError("recorded_by_id") ?? error.fieldError("paid_amount");
        toast.error(message ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
          <DialogDescription>Line totals and the sale total are computed automatically.</DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
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
                          {c.company ? ` (${c.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sale_date">Sale date</Label>
              <Input
                id="sale_date"
                type="date"
                {...register("sale_date")}
                aria-invalid={!!errors.sale_date}
              />
              {errors.sale_date && <p className="text-xs text-destructive">{errors.sale_date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid_amount">Paid amount (optional, default 0)</Label>
              <Input id="paid_amount" type="number" step="0.01" {...register("paid_amount")} />
              {errors.paid_amount && <p className="text-xs text-destructive">{errors.paid_amount.message}</p>}
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
                          <SelectValue>{(v: string) => v || "Select unit"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
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
              Record sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

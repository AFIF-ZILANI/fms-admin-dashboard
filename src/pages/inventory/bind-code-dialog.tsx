import { useState } from "react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { optionalNumber } from "@/lib/zod-helpers";
import type { Item, PurchaseItemOption, StockUnit } from "@/pages/inventory/types";
import type { PurchaseItemLine } from "@/pages/purchases/types";

const bindSchema = z.object({
  purchase_item_id: z.string().min(1, "Select a purchase lot"),
  initial_quantity: optionalNumber(z.coerce.number().positive("Must be positive")),
  bound_by_id: z.string().optional(),
});
type BindFormInput = z.input<typeof bindSchema>;
type BindFormValues = z.output<typeof bindSchema>;

type BindCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, skips the item→lot two-step picker and offers only these
   * lots directly — used by the post-purchase "bind codes" prompt, where
   * the lots are already known (the just-created purchase's own line
   * items) instead of needing a fresh item/purchase-lot search. */
  scopedLots?: PurchaseItemLine[];
};

export function BindCodeDialog({ open, onOpenChange, scopedLots }: BindCodeDialogProps) {
  const [code, setCode] = useState("");
  const [lookupCode, setLookupCode] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState("");

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BindFormInput, unknown, BindFormValues>({
    resolver: zodResolver(bindSchema),
    defaultValues: { purchase_item_id: "", initial_quantity: "", bound_by_id: "" },
  });

  const { data: foundUnit, isFetching: lookingUp } = useGetData<StockUnit>(
    `/stock-units/code/${encodeURIComponent(lookupCode ?? "")}`,
    ["stock-units", "code", lookupCode ?? ""],
    { enabled: !!lookupCode, retry: false }
  );

  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"], { enabled: !scopedLots });
  const { data: purchaseItems } = useGetData<Paginated<PurchaseItemOption>>(
    itemFilter ? `/purchase-items?item_id=${itemFilter}&limit=50` : "/purchase-items?limit=0",
    ["purchase-items", itemFilter],
    { enabled: !!itemFilter && !scopedLots }
  );

  const bind = usePostData<StockUnit, BindFormValues>(() => `/stock-units/${foundUnit?.id}/bind`, ["stock-units"]);

  const canBind = foundUnit?.status === "UNASSIGNED";

  // In scoped mode the lots are already known (the just-created purchase's
  // own line items) -- no item→lot search needed, just pick from these.
  const lotOptions: { id: string; label: string }[] = scopedLots
    ? scopedLots.map((lot) => ({ id: lot.id, label: `${lot.item.name} — qty ${lot.quantity} ${lot.unit}` }))
    : (purchaseItems?.results ?? []).map((lot) => ({
        id: lot.id,
        label: `${new Date(lot.purchase.purchase_date).toLocaleDateString()} — qty ${lot.quantity}`,
      }));

  const onSubmit = (values: BindFormValues) => {
    if (!foundUnit) return;
    // bound_by_id stays "" when ActorSelect is left unset -- the server's schema is
    // `.uuid().optional()`, which rejects "" but accepts the key being absent entirely.
    const payload = { ...values, bound_by_id: values.bound_by_id || undefined };
    bind.mutate(payload, {
      onSuccess: () => {
        toast.success("Code bound");
        handleClose(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCode("");
      setLookupCode(null);
      setItemFilter("");
      reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bind code</DialogTitle>
          <DialogDescription>Attach a printed code to a purchase lot.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g. SU-A1B2C3D4"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setLookupCode(code.trim())} disabled={!code.trim()}>
              Find
            </Button>
          </div>

          {lookupCode && lookingUp && <p className="text-xs text-muted-foreground">Looking up…</p>}
          {lookupCode && !lookingUp && !foundUnit && (
            <p className="text-xs text-destructive">No code found matching "{lookupCode}".</p>
          )}
          {foundUnit && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs">{foundUnit.code}</span>
              <StatusBadge
                tone={foundUnit.status === "UNASSIGNED" ? "info" : "warning"}
                label={humanizeEnum(foundUnit.status)}
              />
            </div>
          )}
          {foundUnit && !canBind && (
            <p className="text-xs text-destructive">
              This code is already {foundUnit.status.toLowerCase()} — only unassigned codes can be bound.
            </p>
          )}

          {canBind && (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
              {!scopedLots && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="item_filter">Item</Label>
                  <Select value={itemFilter} onValueChange={(v) => setItemFilter(v ?? "")}>
                    <SelectTrigger id="item_filter" className="w-full">
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
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="purchase_item_id">Purchase lot</Label>
                <Controller
                  control={control}
                  name="purchase_item_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="purchase_item_id" className="w-full" aria-invalid={!!errors.purchase_item_id}>
                        <SelectValue>
                          {(v: string) => lotOptions.find((lot) => lot.id === v)?.label ?? "Select lot"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {lotOptions.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.purchase_item_id && (
                  <p className="text-xs text-destructive">{errors.purchase_item_id.message}</p>
                )}
                {!scopedLots && itemFilter && lotOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No purchase lots for this item yet.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="initial_quantity">Initial quantity (optional)</Label>
                <Input id="initial_quantity" type="number" step="0.001" {...register("initial_quantity")} />
                <p className="text-xs text-muted-foreground">Leave blank for equipment (non-depleting).</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bound_by_id">Bound by</Label>
                <Controller
                  control={control}
                  name="bound_by_id"
                  render={({ field }) => (
                    <ActorSelect id="bound_by_id" value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Bind code
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

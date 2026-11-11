import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumericInput } from "@/components/utils/NumaricInput";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { usePageTitle } from "@/components/layout/use-page-title";
import { apiFetch, useGetData, usePostData, type Paginated } from "@/lib/api";
import { fetchAllPages } from "@/lib/all-pages";
import { DISCOUNT_TYPE_LABELS, discountAmount, lineNet } from "@/lib/discount";
import { formatTk, humanizeEnum, toCents } from "@/lib/utils";
import { farmToday } from "@/lib/farm-day";
import { ItemCombobox } from "@/pages/purchases/item-combobox";
import { useFormatStock } from "@/pages/inventory/use-format-stock";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import { DISCOUNT_TYPES, type DiscountType } from "@/pages/purchases/types";
import type { Sale, SaleKind } from "@/pages/sales/types";
import { SaleKindPicker } from "@/pages/sales/sale-kind-picker";
import { itemFitsKind } from "@/pages/sales/sale-kinds";

type Line = {
  key: string;
  item_id: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount_type: DiscountType | undefined;
  discount_value: string;
};
type Sellable = { item_id: string; available: number | string };

const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
};
type PendingPayment = {
  status: PaymentStatus;
  amount: string;
  to_instrument_id: string;
  payment_date: string;
  transaction_ref: string;
  note: string;
};

const blankLine = (): Line => ({
  key: crypto.randomUUID(),
  item_id: "",
  quantity: "",
  unit: "",
  unit_price: "",
  discount_type: undefined,
  discount_value: "",
});
const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** Laid out like New purchase: details, a line-items table with units and line discounts, an overall discount,
 *  then the payment. The kind chosen first decides which items and units the lines offer. */
export function SaleCreatePage() {
  usePageTitle("New sale");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const fmt = useFormatStock();

  const [kind, setKind] = useState<SaleKind | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [saleDate, setSaleDate] = useState(farmToday());
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [discountType, setDiscountType] = useState<DiscountType | undefined>(undefined);
  const [discountValue, setDiscountValue] = useState("");
  const [payment, setPayment] = useState<PendingPayment>({
    status: "UNPAID",
    amount: "",
    to_instrument_id: "",
    payment_date: farmToday(),
    transaction_ref: "",
    note: "",
  });
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  // A finalised batch takes no more income, so only running and sold ones are offered.
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches", "sale-picker"]);
  const openBatches = (batches?.results ?? []).filter((b) => b.status !== "CLOSED");
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: units } = useGetData<Paginated<LookupRow>>("/units?active=true&limit=100", ["units", "active"]);
  const unitLabel = (code: string) => units?.results.find((u) => u.code === code)?.label ?? humanizeEnum(code);

  // Only the chosen kind's items, every page of them: the picker searches in the browser.
  const kindQuery =
    kind === "CODED"
      ? "&is_unit_tracked=true"
      : kind === "FARM_MADE"
        ? "&is_farm_made=true"
        : "&is_unit_tracked=false&is_farm_made=false";
  const { data: itemsData } = useQuery({
    queryKey: ["items", "active", kind, "all"],
    queryFn: () => fetchAllPages<Item>(`/items?is_active=true${kindQuery}`, (url) => apiFetch<Paginated<Item>>(url)),
    enabled: kind !== null,
  });
  const allItems = itemsData?.results ?? [];
  const kindItems = kind ? allItems.filter((i) => itemFitsKind(i, kind)) : [];

  // What can be sold: sealed packs per QR item, or the chosen warehouse's balance per stock item.
  const sellableUrl =
    kind === "CODED"
      ? "/sales/sellable?kind=CODED"
      : kind === "STOCK" && warehouseId
        ? `/sales/sellable?kind=STOCK&warehouse_id=${warehouseId}`
        : null;
  const { data: sellable } = useGetData<Sellable[]>(
    sellableUrl ?? "/sales/sellable?kind=CODED",
    ["sales", "sellable", kind, warehouseId],
    { enabled: sellableUrl !== null }
  );

  /** A line's units: the item's base unit plus the units it comes in. A QR line's unit only names the pack (Bottle,
   * Pouch), so any of the item's units will do; stock and farm-made amounts any unit it is bought or used in. */
  const unitsFor = (itemId: string): string[] => {
    const item = allItems.find((i) => i.id === itemId);
    if (!item) return [];
    const extra = (item.itemUnits ?? [])
      .filter((u) => kind === "CODED" || u.is_purchasable || u.is_usable)
      .map((u) => u.unit);
    return [item.unit, ...extra.filter((u) => u !== item.unit)];
  };

  const createSale = usePostData<Sale, Record<string, unknown>>("/sales", ["sales"]);

  // Same order of operations as the server: each line net of its own discount, then the whole-sale discount.
  const subtotal = toCents(lines.reduce((sum, l) => sum + lineNet(l), 0));
  const overallDiscount = toCents(
    discountAmount(subtotal, discountType, discountValue === "" ? undefined : Number(discountValue))
  );
  const total = toCents(Math.max(0, subtotal - overallDiscount));
  const hasAnyDiscount = discountType !== undefined || lines.some((l) => l.discount_type !== undefined);
  const paymentAmount = payment.status === "PAID" ? total : num(payment.amount);

  // Each kind has its own items, so switching always starts the lines over -- ask first if anything was typed.
  const chooseKind = async (next: SaleKind) => {
    if (next === kind) return;
    const typed = lines.some((l) => l.item_id || l.quantity || l.unit_price);
    if (kind && typed) {
      const ok = await confirm({
        title: "Clear the lines?",
        description: "Each kind of sale has its own items. Switching clears the lines you've entered.",
        confirmLabel: "Clear and switch",
      });
      if (!ok) return;
    }
    setKind(next);
    setLines([blankLine()]);
    setErrors({});
  };

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!saleDate) e.sale_date = "Choose the sale date";
    if (kind === "STOCK" && !warehouseId) e.warehouse_id = "Choose the warehouse the stock comes from";
    lines.forEach((l, i) => {
      if (!l.item_id) e[`${l.key}.item_id`] = "Choose an item";
      if (!(num(l.quantity) > 0)) e[`${l.key}.quantity`] = "Enter a quantity";
      if (!l.unit) e[`${l.key}.unit`] = "Choose a unit";
      if (!(num(l.unit_price) > 0)) e[`${l.key}.unit_price`] = "Enter a price";
      if ((l.discount_type !== undefined) !== (l.discount_value !== "")) {
        e.lines = `Line ${i + 1}: pick a discount type and enter a value, or leave both blank.`;
      }
    });
    if (Object.keys(e).some((k) => k.includes(".")) && !e.lines)
      e.lines = "Fill in every line: item, quantity, unit and price.";
    if ((discountType !== undefined) !== (discountValue !== "")) {
      e.discount = "Pick a discount type and enter a value, or leave both blank.";
    }
    if (payment.status !== "UNPAID") {
      if (!(paymentAmount > 0)) e.payment = "Enter a valid payment amount.";
      else if (payment.status === "PARTIAL" && paymentAmount >= total)
        e.payment = 'A partial payment must be less than the total — pick "Paid in full" instead.';
      else if (!payment.to_instrument_id) e.payment = "Choose the account the money went into.";
    }
    return e;
  };

  const submit = () => {
    if (!kind) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      if (e.lines) toast.error(e.lines);
      return;
    }
    const paying = payment.status !== "UNPAID";
    const payload = {
      kind,
      sale_date: saleDate,
      paid_amount: paying ? paymentAmount : 0,
      ...(customerId && { customer_id: customerId }),
      ...(batchId && { batch_id: batchId }),
      ...(kind === "STOCK" && { warehouse_id: warehouseId }),
      ...(discountType !== undefined && { discount_type: discountType, discount_value: Number(discountValue) }),
      ...(paying && {
        paid_to_instrument_id: payment.to_instrument_id,
        payment_date: payment.payment_date || undefined,
        payment_transaction_ref: payment.transaction_ref.trim() || undefined,
        payment_note: payment.note.trim() || undefined,
      }),
      items: lines.map((l) => ({
        item_id: l.item_id,
        quantity: num(l.quantity),
        unit: l.unit,
        unit_price: num(l.unit_price),
        ...(l.discount_type !== undefined && {
          discount_type: l.discount_type,
          discount_value: Number(l.discount_value),
        }),
      })),
    };
    createSale.mutate(payload, {
      onSuccess: (sale) => {
        // The Overview charts are cached under ["analytics", ...], which the ["sales"] key never touches.
        void queryClient.invalidateQueries({ queryKey: ["analytics"] });
        toast.success(paying ? `Sale recorded and ${formatTk(paymentAmount)} received` : "Sale recorded");
        navigate(`/sales/${sale.id}`);
      },
      onError: (error) => {
        toast.error(error.fieldError("sale_date") ?? Object.values(error.fields ?? {})[0] ?? error.message);
      },
    });
  };

  const saving = createSale.isPending;
  const disabled = kind === null;
  const detailsLine = lines.find((l) => l.key === detailsKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales?tab=regular")}>
          <ArrowLeft />
          Back to sales
        </Button>
        <h1 className="text-xl font-semibold">Record a sale</h1>
        <p className="text-sm text-muted-foreground">For anything other than birds.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 id="sale-kind-heading" className="text-base font-medium">
          What are you selling?
        </h2>
        <SaleKindPicker value={kind} onChange={(k) => void chooseKind(k)} />
      </section>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={disabled} className={disabled ? "flex flex-col gap-6 opacity-50" : "flex flex-col gap-6"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sale details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer_id">Customer (optional)</Label>
                <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                  <SelectTrigger id="customer_id" className="w-full">
                    <SelectValue>
                      {(v: string) => customers?.results.find((c) => c.id === v)?.profile.name ?? "Walk-in"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in</SelectItem>
                    {(customers?.results ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.profile.name}
                        {c.company ? ` (${c.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="batch_id">Batch (optional)</Label>
                <Select value={batchId} onValueChange={(v) => setBatchId(v ?? "")}>
                  <SelectTrigger id="batch_id" className="w-full">
                    <SelectValue>
                      {(v: string) => openBatches.find((b) => b.id === v)?.batch_code ?? "Not for a batch"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not for a batch</SelectItem>
                    {openBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_code}
                        {b.status === "SOLD" ? " (sold)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {kind === "STOCK" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="warehouse_id">Take stock from</Label>
                  <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
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
                  {errors.warehouse_id && <p className="text-xs text-destructive">{errors.warehouse_id}</p>}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sale_date">Sale date</Label>
                {/* Capped at today: a future-dated sale shows in tables but in no chart. */}
                <Input
                  id="sale_date"
                  type="date"
                  max={farmToday()}
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  aria-invalid={!!errors.sale_date}
                />
                {errors.sale_date && <p className="text-xs text-destructive">{errors.sale_date}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((all) => [...all, blankLine()])}
              >
                <Plus />
                Add line
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">Item</TableHead>
                    <TableHead className="w-[15%]">Quantity</TableHead>
                    <TableHead className="w-[16%]">Unit</TableHead>
                    <TableHead className="w-[17%]">Unit price (৳)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const item = allItems.find((i) => i.id === line.item_id);
                    const stockLeft = sellable?.find((s) => s.item_id === line.item_id)?.available;
                    // Shown only once the counts are in, so a loading list never reads as "0 in stock".
                    const hint =
                      !line.item_id || !sellable
                        ? undefined
                        : kind === "CODED"
                          ? `${stockLeft ?? 0} sealed packs in stock`
                          : kind === "STOCK"
                            ? `${fmt.stock(stockLeft ?? 0, line.item_id, item?.unit ?? "")} in this warehouse`
                            : undefined;
                    const err = (f: string) => errors[`${line.key}.${f}`];
                    return (
                      <TableRow key={line.key} className="align-top">
                        <TableCell>
                          <ItemCombobox
                            items={kindItems}
                            value={line.item_id}
                            invalid={!!err("item_id")}
                            onChange={(id) => setLine(line.key, { item_id: id, unit: "" })}
                          />
                          {hint && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</p>}
                        </TableCell>
                        <TableCell>
                          {/* QR packs are whole: one scan each. */}
                          <NumericInput
                            allowDecimal={kind !== "CODED"}
                            decimalPlaces={3}
                            aria-label="Quantity"
                            aria-invalid={!!err("quantity")}
                            value={line.quantity}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={line.unit}
                            onValueChange={(v) => setLine(line.key, { unit: v ?? "" })}
                            disabled={!line.item_id}
                          >
                            <SelectTrigger className="w-full" aria-label="Unit" aria-invalid={!!err("unit")}>
                              <SelectValue>{(v: string) => (v ? unitLabel(v) : "Unit")}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {unitsFor(line.item_id).map((u) => (
                                <SelectItem key={u} value={u}>
                                  {unitLabel(u)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <NumericInput
                            allowDecimal
                            decimalPlaces={2}
                            aria-label="Unit price"
                            aria-invalid={!!err("unit_price")}
                            value={line.unit_price}
                            onChange={(e) => setLine(line.key, { unit_price: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(lineNet(line))}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Line discount"
                              onClick={() => setDetailsKey(line.key)}
                            >
                              <MoreHorizontal />
                            </Button>
                            {lines.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove line"
                                onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-3 flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Overall discount (optional)</Label>
                  <Select
                    value={discountType ?? ""}
                    onValueChange={(v) => {
                      setDiscountType((v as DiscountType) || undefined);
                      if (!v) setDiscountValue("");
                    }}
                  >
                    <SelectTrigger className="w-36" aria-label="Overall discount type">
                      <SelectValue>{(v: DiscountType) => (v ? DISCOUNT_TYPE_LABELS[v] : "None")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {DISCOUNT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DISCOUNT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <NumericInput
                    allowDecimal
                    decimalPlaces={2}
                    disabled={discountType === undefined}
                    className="w-24"
                    aria-label="Overall discount"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {errors.discount && <p className="text-xs text-destructive">{errors.discount}</p>}

                {hasAnyDiscount ? (
                  <div className="text-right text-sm tabular-nums">
                    <div className="text-muted-foreground">Subtotal: {formatTk(subtotal)}</div>
                    {overallDiscount > 0 && (
                      <div className="text-muted-foreground">Discount: −{formatTk(overallDiscount)}</div>
                    )}
                    <div className="font-medium">Total: {formatTk(total)}</div>
                  </div>
                ) : (
                  <div className="text-sm font-medium tabular-nums">Total: {formatTk(total)}</div>
                )}
                {kind === "CODED" && (
                  <p className="text-xs text-muted-foreground">
                    These packs leave stock when a manager scans each one on the phone.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Payment</CardTitle>
              <Select
                value={payment.status}
                onValueChange={(v) => setPayment((p) => ({ ...p, status: (v as PaymentStatus) ?? "UNPAID" }))}
              >
                <SelectTrigger className="w-44" aria-label="Payment status">
                  <SelectValue>{(v: PaymentStatus) => PAYMENT_STATUS_LABELS[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            {payment.status !== "UNPAID" && (
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payment_amount">Amount (৳)</Label>
                  <NumericInput
                    id="payment_amount"
                    allowDecimal
                    decimalPlaces={2}
                    disabled={payment.status === "PAID"}
                    value={payment.status === "PAID" ? String(total) : payment.amount}
                    onChange={(e) => setPayment((p) => ({ ...p, amount: e.target.value }))}
                  />
                  {payment.status === "PARTIAL" && (
                    <p className="text-xs text-muted-foreground">
                      Due after this payment: {formatTk(Math.max(0, total - paymentAmount))}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="paid_to_instrument_id">Paid into</Label>
                  <FarmAccountSelect
                    id="paid_to_instrument_id"
                    value={payment.to_instrument_id}
                    onChange={(v) => setPayment((p) => ({ ...p, to_instrument_id: v }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payment_date">Payment date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={payment.payment_date}
                    onChange={(e) => setPayment((p) => ({ ...p, payment_date: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="transaction_ref">Transaction ref (optional)</Label>
                  <Input
                    id="transaction_ref"
                    value={payment.transaction_ref}
                    onChange={(e) => setPayment((p) => ({ ...p, transaction_ref: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="payment_note">Note (optional)</Label>
                  <Input
                    id="payment_note"
                    value={payment.note}
                    onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))}
                  />
                </div>
                {errors.payment && <p className="text-xs text-destructive sm:col-span-2">{errors.payment}</p>}
              </CardContent>
            )}
          </Card>
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => navigate("/sales?tab=regular")}>
            Cancel
          </Button>
          <Button type="submit" disabled={disabled || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Record sale
          </Button>
        </div>
      </form>

      <Dialog open={detailsLine !== undefined} onOpenChange={(open) => !open && setDetailsKey(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Line discount</DialogTitle>
            <DialogDescription>Taken off this line before any overall discount.</DialogDescription>
          </DialogHeader>
          {detailsLine && (
            <div className="flex items-center gap-2">
              <Label className="w-20 shrink-0">Discount</Label>
              <Select
                value={detailsLine.discount_type ?? ""}
                onValueChange={(v) =>
                  setLine(detailsLine.key, {
                    discount_type: (v as DiscountType) || undefined,
                    ...(!v && { discount_value: "" }),
                  })
                }
              >
                <SelectTrigger className="w-36" aria-label="Line discount type">
                  <SelectValue>{(v: DiscountType) => (v ? DISCOUNT_TYPE_LABELS[v] : "None")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {DISCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DISCOUNT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NumericInput
                allowDecimal
                decimalPlaces={2}
                disabled={detailsLine.discount_type === undefined}
                className="w-24"
                aria-label="Line discount value"
                value={detailsLine.discount_value}
                onChange={(e) => setLine(detailsLine.key, { discount_value: e.target.value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setDetailsKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

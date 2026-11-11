import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { cn, formatTk } from "@/lib/utils";
import { farmToday } from "@/lib/farm-day";
import { ItemCombobox } from "@/pages/purchases/item-combobox";
import { useFormatStock } from "@/pages/inventory/use-format-stock";
import type { Item, Warehouse } from "@/pages/inventory/types";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import type { Sale, SaleKind } from "@/pages/sales/types";
import { SaleKindPicker } from "@/pages/sales/sale-kind-picker";
import { itemFitsKind, linesValidForKind } from "@/pages/sales/sale-kinds";

type Line = { key: string; item_id: string; quantity: string; unit: string; unit_price: string };
type Sellable = { item_id: string; available: number | string };

const blankLine = (): Line => ({ key: crypto.randomUUID(), item_id: "", quantity: "", unit: "", unit_price: "" });
const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** Units a line can be entered in: the item's base unit plus the units it is used/sold in. */
function unitsOf(item: Item | undefined): string[] {
  if (!item) return [];
  const extra = (item.itemUnits ?? []).filter((u) => u.is_usable).map((u) => u.unit);
  return [item.unit, ...extra.filter((u) => u !== item.unit)];
}

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
  const [paid, setPaid] = useState("");
  const [accountId, setAccountId] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  // A finalised batch takes no more income, so only running and sold ones are offered.
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches", "sale-picker"]);
  const openBatches = (batches?.results ?? []).filter((b) => b.status !== "CLOSED");
  const { data: warehouses } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const { data: itemsData } = useGetData<Paginated<Item>>("/items?is_active=true&limit=100", ["items", "active"]);
  const allItems = itemsData?.results ?? [];
  const kindItems = kind ? allItems.filter((i) => itemFitsKind(i, kind)) : [];

  // What can be sold: sealed bottles per QR item, or the chosen warehouse's balance per stock item.
  const sellableUrl =
    kind === "CODED"
      ? "/sales/sellable?kind=CODED"
      : kind === "STOCK" && warehouseId
        ? `/sales/sellable?kind=STOCK&warehouse_id=${warehouseId}`
        : null;
  const { data: sellable } = useGetData<Sellable[]>(
    sellableUrl ?? "/sales/sellable?kind=CODED",
    ["sales", "sellable", kind, warehouseId],
    {
      enabled: sellableUrl !== null,
    }
  );
  const available = (itemId: string) => sellable?.find((s) => s.item_id === itemId)?.available;

  const createSale = usePostData<Sale, Record<string, unknown>>("/sales", ["sales"]);

  const total = lines.reduce((sum, l) => sum + num(l.quantity) * num(l.unit_price), 0);
  const paidNum = num(paid);
  const filledLines = lines.filter((l) => l.item_id);

  const chooseKind = async (next: SaleKind) => {
    if (next === kind) return;
    const stale = !linesValidForKind(lines, allItems, next) || lines.some((l) => l.quantity || l.unit_price);
    if (kind && filledLines.length && stale) {
      const ok = await confirm({
        title: "Clear the lines?",
        description: "The lines you've entered don't fit this kind of sale. Switching clears them.",
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
    if (paidNum < 0) e.paid = "Must be 0 or more";
    if (paidNum > total) e.paid = "Can't be more than the sale total";
    if (paidNum > 0 && !accountId) e.account = "Choose the account the money went into";
    lines.forEach((l) => {
      if (!l.item_id) e[`${l.key}.item_id`] = "Choose an item";
      const q = num(l.quantity);
      if (!(q > 0)) e[`${l.key}.quantity`] = kind === "CODED" ? "Enter how many bottles" : "Enter an amount";
      else if (kind === "CODED" && !Number.isInteger(q)) e[`${l.key}.quantity`] = "Whole bottles only";
      if (kind !== "CODED" && !l.unit) e[`${l.key}.unit`] = "Choose a unit";
      if (!(num(l.unit_price) > 0)) e[`${l.key}.unit_price`] = "Enter a price";
    });
    return e;
  };

  const submit = () => {
    if (!kind) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = {
      kind,
      sale_date: saleDate,
      paid_amount: paidNum,
      ...(customerId && { customer_id: customerId }),
      ...(batchId && { batch_id: batchId }),
      ...(kind === "STOCK" && { warehouse_id: warehouseId }),
      ...(paidNum > 0 && { paid_to_instrument_id: accountId }),
      items: lines.map((l) => ({
        item_id: l.item_id,
        quantity: num(l.quantity),
        unit_price: num(l.unit_price),
        ...(kind !== "CODED" && { unit: l.unit }),
      })),
    };
    createSale.mutate(payload, {
      onSuccess: (sale) => {
        // The Overview charts are cached under ["analytics", ...], which the ["sales"] key never touches.
        void queryClient.invalidateQueries({ queryKey: ["analytics"] });
        toast.success("Sale recorded");
        navigate(`/sales/${sale.id}`);
      },
      onError: (error) => {
        const field = error.fieldError("sale_date") ?? error.fieldError("paid_to_instrument_id");
        toast.error(field ?? error.message);
      },
    });
  };

  const saving = createSale.isPending;
  const disabled = kind === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales?tab=regular")}>
          <ArrowLeft />
          Back to sales
        </Button>
        <h1 className="text-xl font-semibold">Record a sale</h1>
        <p className="text-sm text-muted-foreground">For anything other than birds. Totals work themselves out.</p>
      </div>

      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 id="sale-kind-heading" className="text-base font-medium">
              What are you selling?
            </h2>
            <SaleKindPicker value={kind} onChange={(k) => void chooseKind(k)} />
          </section>

          <fieldset disabled={disabled} className={cn("flex min-w-0 flex-col gap-6", disabled && "opacity-50")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sale</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer (optional)" htmlFor="customer_id">
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
                </Field>
                <Field label="Sale date" htmlFor="sale_date" error={errors.sale_date}>
                  {/* Capped at today: a future-dated sale shows in tables but in no chart. */}
                  <Input
                    id="sale_date"
                    type="date"
                    max={farmToday()}
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    aria-invalid={!!errors.sale_date}
                  />
                </Field>
                <Field
                  label="Batch (optional)"
                  htmlFor="batch_id"
                  hint="Counts in that batch's profit, for example litter after the flock is sold."
                >
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
                </Field>
                {kind === "STOCK" && (
                  <Field label="Take stock from" htmlFor="warehouse_id" error={errors.warehouse_id}>
                    <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
                      <SelectTrigger id="warehouse_id" className="w-full" aria-invalid={!!errors.warehouse_id}>
                        <SelectValue>
                          {(v: string) => warehouses?.results.find((w) => w.id === v)?.name ?? "Choose a warehouse"}
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
                  </Field>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-base">Lines</CardTitle>
                  <CardDescription>
                    {kind === "CODED"
                      ? "How many bottles of each item, and the price per bottle."
                      : "How much of each item, and the price per unit."}
                  </CardDescription>
                </div>
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
              <CardContent className="flex flex-col gap-4">
                {lines.map((line, index) => {
                  const item = kindItems.find((i) => i.id === line.item_id);
                  const stockLeft = line.item_id ? available(line.item_id) : undefined;
                  const hint =
                    !line.item_id || kind === "FARM_MADE"
                      ? undefined
                      : kind === "CODED"
                        ? `${stockLeft ?? 0} sealed bottles in stock`
                        : warehouseId
                          ? `${fmt.stock(stockLeft ?? 0, line.item_id, item?.unit ?? "")} in this warehouse`
                          : "Choose a warehouse to see what's in stock";
                  return (
                    <div key={line.key} className="flex flex-col gap-3">
                      {index > 0 && <Separator />}
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <Field
                          label="Item"
                          htmlFor={`${line.key}-item`}
                          error={errors[`${line.key}.item_id`]}
                          hint={hint}
                        >
                          <ItemCombobox
                            items={kindItems}
                            value={line.item_id}
                            invalid={!!errors[`${line.key}.item_id`]}
                            onChange={(id) =>
                              setLine(line.key, {
                                item_id: id,
                                unit: unitsOf(allItems.find((i) => i.id === id))[0] ?? "",
                              })
                            }
                          />
                        </Field>
                        <Field
                          label={kind === "CODED" ? "Bottles" : "Amount"}
                          htmlFor={`${line.key}-qty`}
                          error={errors[`${line.key}.quantity`] ?? errors[`${line.key}.unit`]}
                        >
                          <div className="flex gap-2">
                            <Input
                              id={`${line.key}-qty`}
                              type="number"
                              inputMode={kind === "CODED" ? "numeric" : "decimal"}
                              step={kind === "CODED" ? 1 : "any"}
                              min={0}
                              value={line.quantity}
                              onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                              aria-invalid={!!errors[`${line.key}.quantity`]}
                            />
                            {kind !== "CODED" && (
                              <Select value={line.unit} onValueChange={(v) => setLine(line.key, { unit: v ?? "" })}>
                                <SelectTrigger
                                  className="w-24 shrink-0"
                                  aria-label="Unit"
                                  aria-invalid={!!errors[`${line.key}.unit`]}
                                >
                                  <SelectValue>{(v: string) => (v ? v.toLowerCase() : "Unit")}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {unitsOf(item).map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {u.toLowerCase()}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </Field>
                        <Field
                          label={kind === "CODED" ? "Price per bottle (৳)" : "Price per unit (৳)"}
                          htmlFor={`${line.key}-price`}
                          error={errors[`${line.key}.unit_price`]}
                        >
                          <Input
                            id={`${line.key}-price`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            value={line.unit_price}
                            onChange={(e) => setLine(line.key, { unit_price: e.target.value })}
                            aria-invalid={!!errors[`${line.key}.unit_price`]}
                          />
                        </Field>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                          >
                            <Trash2 />
                            Remove line
                          </Button>
                        ) : (
                          <span />
                        )}
                        <span className="tabular-nums text-muted-foreground">
                          {formatTk(num(line.quantity) * num(line.unit_price))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Paid now (৳)"
                  htmlFor="paid"
                  error={errors.paid}
                  hint="Leave empty if nothing was paid yet."
                >
                  <Input
                    id="paid"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                    aria-invalid={!!errors.paid}
                  />
                </Field>
                {paidNum > 0 && (
                  <Field label="Paid into" htmlFor="paid_to_instrument_id" error={errors.account}>
                    <FarmAccountSelect
                      id="paid_to_instrument_id"
                      value={accountId}
                      onChange={setAccountId}
                      invalid={!!errors.account}
                    />
                  </Field>
                )}
              </CardContent>
            </Card>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-6">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Sale total</span>
                <span className="text-4xl font-semibold tabular-nums">{formatTk(total)}</span>
              </div>
              <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
                {filledLines.length === 0 ? (
                  <p className="text-muted-foreground">
                    {kind ? "Lines you add show up here." : "Choose what you're selling to start."}
                  </p>
                ) : (
                  filledLines.map((l) => (
                    <div key={l.key} className="flex items-baseline justify-between gap-3">
                      <dt className="min-w-0 truncate">
                        {allItems.find((i) => i.id === l.item_id)?.name}
                        <span className="text-muted-foreground">
                          {" "}
                          {kind === "CODED"
                            ? `${num(l.quantity)} bottles`
                            : `${num(l.quantity)} ${l.unit.toLowerCase()}`}
                        </span>
                      </dt>
                      <dd>{formatTk(num(l.quantity) * num(l.unit_price))}</dd>
                    </div>
                  ))
                )}
              </dl>
              <Separator />
              <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums">
                <div>
                  <dt className="text-xs text-muted-foreground">Paid now</dt>
                  <dd className="font-medium">{formatTk(paidNum)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due</dt>
                  <dd className="font-medium">{formatTk(Math.max(0, total - paidNum))}</dd>
                </div>
              </dl>
              {kind === "CODED" && (
                <p className="rounded-lg bg-muted/60 p-3 text-sm">
                  These bottles leave stock when a manager scans them on the phone.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Button type="submit" size="lg" disabled={disabled || saving}>
                  {saving ? "Recording…" : "Record sale"}
                </Button>
                <Button type="button" variant="ghost" disabled={saving} onClick={() => navigate("/sales?tab=regular")}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>
      {confirmDialog}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground tabular-nums">{hint}</p>
      )}
    </div>
  );
}

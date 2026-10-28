import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { NumericInput } from "@/components/utils/NumaricInput";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { cn, formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import { BIRD_GRADES, type BirdGrade, type BirdSale } from "@/pages/sales/types";
import {
  computeSale,
  discountForFinal,
  SALE_PAYMENT_STATUSES,
  type SaleFigures,
  type SalePaymentStatus,
} from "@/pages/sales/bird-sale-math";

const PAYMENT_LABELS: Record<SalePaymentStatus, string> = {
  DUE: "Due",
  FULL: "Paid in full",
  PARTIAL: "Partly paid",
};
const PAYMENT_TONE: Record<SalePaymentStatus, Tone> = { DUE: "neutral", FULL: "success", PARTIAL: "warning" };

/** One house the birds were caught in. birds is only used when there are several -- with one house,
 * the sale's own bird count is that house's count. */
type HouseRow = { house_id: string; birds: string };

type Form = {
  batch_id: string;
  houses: HouseRow[];
  customer_id: string;
  sale_date: string;
  grade: BirdGrade | "";
  birds: string;
  male: string;
  female: string;
  /** once typed by hand, female stops following birds − male */
  femaleTouched: boolean;
  total_weight: string;
  crate_size: string;
  round_crates: boolean;
  crates: string;
  deduction_g: string;
  price: string;
  discount: string;
  payment: SalePaymentStatus;
  received: string;
  account: string;
  labour_on: boolean;
  labour_cost: string;
  labour_paid: boolean;
  labour_account: string;
};

const today = () => new Date().toISOString().slice(0, 10);

/** The farm's usual crate and its usual deduction -- prefilled, still editable per load. */
const DEFAULT_CRATE_SIZE_KG = "20";
const DEFAULT_DEDUCTION_G = "300";

function blankForm(keep?: Partial<Form>): Form {
  return {
    batch_id: "",
    houses: [{ house_id: "", birds: "" }],
    customer_id: "",
    sale_date: today(),
    grade: "",
    birds: "",
    male: "",
    female: "",
    femaleTouched: false,
    total_weight: "",
    crate_size: DEFAULT_CRATE_SIZE_KG,
    round_crates: true,
    crates: "",
    deduction_g: DEFAULT_DEDUCTION_G,
    price: "",
    discount: "",
    payment: "DUE",
    received: "",
    account: "",
    labour_on: false,
    labour_cost: "",
    labour_paid: true,
    labour_account: "",
    ...keep,
  };
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
const kg = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;

type Errors = Partial<Record<keyof Form | "house_id" | "net", string>>;

function validate(f: Form, s: SaleFigures, liveOf: (houseId: string) => number | undefined): Errors {
  const e: Errors = {};
  const multi = f.houses.length > 1;
  const liveInHouse = multi ? undefined : liveOf(f.houses[0]!.house_id);
  if (!f.batch_id) e.batch_id = "Choose the batch the birds came from";
  if (f.houses.some((h) => !h.house_id)) e.house_id = "Choose the house they were caught in";
  else if (multi) {
    const short = f.houses.find((h) => num(h.birds) > (liveOf(h.house_id) ?? Infinity));
    if (f.houses.some((h) => num(h.birds) <= 0)) e.house_id = "Enter how many birds came from each house";
    else if (short) e.house_id = `Only ${liveOf(short.house_id)} birds are live in one of these houses`;
  }
  if (!f.sale_date) e.sale_date = "Enter the sale date";
  if (!f.grade) e.grade = "Choose a grade";
  const birds = num(f.birds);
  if (!Number.isInteger(birds) || birds <= 0) e.birds = "Enter how many birds were sold";
  else if (liveInHouse !== undefined && birds > liveInHouse) e.birds = `Only ${liveInHouse} birds are live in this house`;
  if (f.male !== "" || f.female !== "") {
    if (num(f.male) + num(f.female) !== birds) e.female = "Male + female must add up to the number of birds";
  }
  if (num(f.total_weight) <= 0) e.total_weight = "Enter the total weight from the scale";
  if (!s.cratesDerived && f.crates !== "" && num(f.crates) < 0) e.crates = "Crates can't be negative";
  if (s.deductionKg >= num(f.total_weight) && num(f.total_weight) > 0) e.deduction_g = "Deduction is more than the total weight";
  if (num(f.price) <= 0) e.price = "Enter the price per kg";
  if (num(f.discount) > s.total) e.discount = "Discount can't be more than the total";
  if (f.payment === "PARTIAL") {
    const r = num(f.received);
    if (r <= 0) e.received = "Enter how much was paid, or how much is still due";
    else if (r >= s.final) e.received = "That covers the whole amount -- choose Paid in full";
  }
  if (s.received > 0 && !f.account) e.account = "Choose the account the money went into";
  if (f.labour_on) {
    if (num(f.labour_cost) <= 0) e.labour_cost = "Enter what the loading labour cost";
    if (f.labour_paid && !f.labour_account) e.labour_account = "Choose the account it was paid from";
  }
  return e;
}

export function BirdSaleCreatePage() {
  usePageTitle("New bird sale");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [f, setF] = useState<Form>(() => blankForm());
  const [finalDraft, setFinalDraft] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((p) => ({ ...p, [key]: value }));

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?status=RUNNING&limit=100", ["batches", "running"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100&is_active=true", ["customers"]);
  const createSale = usePostData<BirdSale, Record<string, unknown>>("/bird-sales", ["bird-sales"]);

  const batch = batches?.results.find((b) => b.id === f.batch_id);
  const houses = (batch?.houseBalances ?? []).filter((hb) => hb.quantity > 0);
  const liveOf = (houseId: string) => houses.find((hb) => hb.house_id === houseId)?.quantity;
  const houseNameOf = (houseId: string) => houses.find((hb) => hb.house_id === houseId)?.house.name;
  const multi = f.houses.length > 1;
  const liveInHouse = multi ? undefined : liveOf(f.houses[0]!.house_id);

  const s = computeSale({
    totalWeightKg: num(f.total_weight),
    crateSizeKg: num(f.crate_size),
    roundCrates: f.round_crates,
    cratesManual: num(f.crates),
    deductionPerCrateG: num(f.deduction_g),
    birds: num(f.birds),
    pricePerKg: num(f.price),
    discount: num(f.discount),
    payment: f.payment,
    receivedPartial: num(f.received),
  });
  const errors = validate(f, s, liveOf);
  const err = (k: keyof Errors) => (showErrors ? errors[k] : undefined);
  // The house ceiling is worth knowing before submit.
  const birdsOver = liveInHouse !== undefined && num(f.birds) > liveInHouse;

  const pickBatch = (id: string) => {
    const next = batches?.results.find((b) => b.id === id);
    const live = (next?.houseBalances ?? []).filter((hb) => hb.quantity > 0);
    // One house holding birds is the usual case -- no need to make anyone pick it.
    setF((p) => ({ ...p, batch_id: id, houses: [{ house_id: live.length === 1 ? live[0]!.house_id : "", birds: "" }] }));
  };

  /** Female follows birds − male until someone types it themselves. */
  const followFemale = (p: Form, birds: string, male: string): string => {
    if (p.femaleTouched || male === "" || birds === "") return p.female;
    const rest = num(birds) - num(male);
    return rest >= 0 ? String(rest) : p.female;
  };

  /** With several houses the sale's bird count is their sum. Going from one house to several, the
   * count already typed belongs to the house already picked (always row 0). */
  const setRows = (rows: HouseRow[]) =>
    setF((p) => {
      if (rows.length === 1) return { ...p, houses: rows };
      const firstId = p.houses.length === 1 ? p.houses[0]!.house_id : "";
      const next = rows.map((r, i) =>
        i === 0 && firstId && r.house_id === firstId && r.birds === "" ? { ...r, birds: p.birds } : r,
      );
      const total = next.reduce((n, r) => n + num(r.birds), 0);
      const birds = total > 0 ? String(total) : "";
      return { ...p, houses: next, birds, female: followFemale(p, birds, p.male) };
    });
  const setRow = (i: number, patch: Partial<HouseRow>) =>
    setRows(f.houses.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unpicked = houses.filter((h) => !f.houses.some((r) => r.house_id === h.house_id));

  const onFinalChange = (v: string) => {
    setFinalDraft(v);
    if (v === "") return set("discount", "");
    const discount = discountForFinal(s.total, num(v));
    set("discount", discount > 0 ? String(discount) : "");
  };

  const submit = (another: boolean) => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      toast.error("Some details need fixing before this sale can be recorded");
      return;
    }
    const male = f.male === "" ? undefined : num(f.male);
    const female = f.female === "" ? undefined : num(f.female);
    const payload = {
      batch_id: f.batch_id,
      ...(multi
        ? { houses: f.houses.map((h) => ({ house_id: h.house_id, birds_count: num(h.birds) })) }
        : { house_id: f.houses[0]!.house_id }),
      customer_id: f.customer_id || undefined,
      sale_date: f.sale_date,
      grade: f.grade,
      birds_count: num(f.birds),
      male_count: male,
      female_count: female,
      total_weight: num(f.total_weight),
      total_katha: s.crates,
      avg_wt_per_katha_kg: num(f.crate_size) > 0 ? num(f.crate_size) : undefined,
      dholta_in_g: num(f.deduction_g),
      net_weight: s.netKg,
      avg_weight_g: s.avgWeightG ?? undefined,
      price_per_kg: num(f.price),
      discount_amount: s.discount > 0 ? s.discount : undefined,
      paid_amount: s.received,
      paid_to_instrument_id: s.received > 0 ? f.account : undefined,
      labour_cost: f.labour_on ? num(f.labour_cost) : undefined,
      labour_paid_from_instrument_id: f.labour_on && f.labour_paid ? f.labour_account : undefined,
    };
    createSale.mutate(payload, {
      onSuccess: (sale) => {
        // The sale moves the house balance, the books and (with labour) the batch's expenses.
        for (const key of ["analytics", "batches", "expenses", "payments", "outstanding"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        toast.success(`Bird sale recorded: ${num(f.birds)} birds, ${formatMoney(s.final)}`);
        if (another) {
          // Next truck from the same shed: keep where, when and the price; clear the load itself.
          setF(blankForm({ batch_id: f.batch_id, houses: f.houses.map((h) => ({ house_id: h.house_id, birds: "" })), sale_date: f.sale_date, price: f.price, crate_size: f.crate_size, round_crates: f.round_crates, deduction_g: f.deduction_g }));
          setShowErrors(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          navigate(`/sales/birds/${sale.id}`);
        }
      },
      onError: (error) => {
        toast.error(
          error.fieldError("birds_count") ??
            error.fieldError("houses") ??
            error.fieldError("paid_to_instrument_id") ??
            error.fieldError("labour_cost") ??
            error.message,
        );
      },
    });
  };

  const saving = createSale.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales?tab=birds")}>
          <ArrowLeft />
          Back to bird sales
        </Button>
        <h1 className="text-xl font-semibold">Record a bird sale</h1>
        <p className="text-sm text-muted-foreground">
          Enter the load as it was weighed. Crates, deduction, net weight and the amounts work themselves out.
        </p>
      </div>

      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* ── Where the birds came from, and who bought them ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sale</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Batch" htmlFor="batch" error={err("batch_id")}>
                <Select value={f.batch_id} onValueChange={(v) => pickBatch(v ?? "")}>
                  <SelectTrigger id="batch" className="w-full" aria-invalid={!!err("batch_id")}>
                    <SelectValue>
                      {(v: string) => batches?.results.find((b) => b.id === v)?.batch_code ?? "Choose a running batch"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(batches?.results ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_code} ({humanizeEnum(b.breed)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {batches && batches.results.length === 0 && (
                  <p className="text-xs text-muted-foreground">No batch is running, so there are no birds to sell.</p>
                )}
              </Field>
              <div className={cn("flex flex-col gap-1.5", multi && "sm:col-span-2")}>
                <Label htmlFor="house-0">{multi ? "Houses" : "House"}</Label>
                {f.houses.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={row.house_id} onValueChange={(v) => setRow(i, { house_id: v ?? "" })} disabled={!batch}>
                      <SelectTrigger id={`house-${i}`} className="w-full min-w-0 flex-1" aria-invalid={!!err("house_id") && !row.house_id}>
                        <SelectValue>
                          {(v: string) => houseNameOf(v) ?? (batch ? "Choose a house" : "Choose a batch first")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {houses
                          .filter((h) => h.house_id === row.house_id || unpicked.includes(h))
                          .map((h) => (
                            <SelectItem key={h.house_id} value={h.house_id}>
                              {h.house.name} ({h.quantity.toLocaleString()} live)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {multi && (
                      <>
                        <NumericInput
                          aria-label={`Birds from ${houseNameOf(row.house_id) ?? `house ${i + 1}`}`}
                          placeholder="Birds"
                          className="w-28"
                          value={row.birds}
                          onChange={(e) => setRow(i, { birds: e.target.value })}
                          aria-invalid={!!err("house_id") && (num(row.birds) <= 0 || num(row.birds) > (liveOf(row.house_id) ?? Infinity))}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove this house"
                          onClick={() => setRows(f.houses.filter((_, j) => j !== i))}
                        >
                          <X />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {err("house_id") ? (
                  <p className="text-xs text-destructive" role="alert">
                    {err("house_id")}
                  </p>
                ) : (
                  liveInHouse !== undefined && (
                    <p className="text-xs text-muted-foreground tabular-nums">{liveInHouse.toLocaleString()} birds live here</p>
                  )
                )}
                {/* Most loads come from one house; a truck filled from several gets a row per house. */}
                {batch && unpicked.length > 0 && f.houses.every((r) => r.house_id) && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setRows([...f.houses, { house_id: "", birds: "" }])}>
                      <Plus />
                      Add another house
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows([...f.houses, ...unpicked.map((h) => ({ house_id: h.house_id, birds: "" }))])}
                    >
                      All houses
                    </Button>
                  </div>
                )}
              </div>
              <Field label="Customer" htmlFor="customer" hint="Leave empty for a walk-in buyer">
                <Select value={f.customer_id} onValueChange={(v) => set("customer_id", v ?? "")}>
                  <SelectTrigger id="customer" className="w-full">
                    <SelectValue>
                      {(v: string) => customers?.results.find((c) => c.id === v)?.profile.name ?? "Walk-in buyer"}
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
              </Field>
              <Field label="Sale date" htmlFor="sale_date" error={err("sale_date")}>
                <Input
                  id="sale_date"
                  type="date"
                  max={today()}
                  value={f.sale_date}
                  onChange={(e) => set("sale_date", e.target.value)}
                  aria-invalid={!!err("sale_date")}
                />
              </Field>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label id="grade-label">Grade</Label>
                <Segmented
                  labelledBy="grade-label"
                  options={BIRD_GRADES.map((g) => ({ value: g, label: humanizeEnum(g) }))}
                  value={f.grade}
                  onChange={(v) => set("grade", v as BirdGrade)}
                  invalid={!!err("grade")}
                />
                {err("grade") && <p className="text-xs text-destructive">{err("grade")}</p>}
              </div>
            </CardContent>
          </Card>

          {/* ── The birds themselves ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Birds</CardTitle>
              <CardDescription>Male and female are optional. Fill one and the other follows.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Number of birds"
                htmlFor="birds"
                error={err("birds") ?? (birdsOver ? `Only ${liveInHouse} birds are live in this house` : undefined)}
                hint={multi ? "Added up from the houses above" : undefined}
              >
                <NumericInput
                  id="birds"
                  readOnly={multi}
                  value={f.birds}
                  onChange={(e) => {
                    const birds = e.target.value;
                    setF((p) => ({ ...p, birds, female: followFemale(p, birds, p.male) }));
                  }}
                  aria-invalid={!!err("birds") || birdsOver}
                />
              </Field>
              <Field label="Male" htmlFor="male">
                <NumericInput
                  id="male"
                  allowZero
                  value={f.male}
                  onChange={(e) => {
                    const male = e.target.value;
                    setF((p) => ({ ...p, male, female: followFemale(p, p.birds, male) }));
                  }}
                />
              </Field>
              <Field label="Female" htmlFor="female" error={err("female")}>
                <NumericInput
                  id="female"
                  allowZero
                  value={f.female}
                  onChange={(e) => setF((p) => ({ ...p, female: e.target.value, femaleTouched: e.target.value !== "" }))}
                  aria-invalid={!!err("female")}
                />
              </Field>
            </CardContent>
          </Card>

          {/* ── The weighing ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weighing</CardTitle>
              <CardDescription>
                Give the crate size and the crates are counted from the total weight; leave it empty to enter the
                crate count yourself.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Total weight (kg)" htmlFor="total_weight" error={err("total_weight")} hint="Gross, crates included">
                <NumericInput
                  id="total_weight"
                  allowDecimal
                  decimalPlaces={2}
                  value={f.total_weight}
                  onChange={(e) => set("total_weight", e.target.value)}
                  aria-invalid={!!err("total_weight")}
                />
              </Field>
              <Field label="Crate size (kg per crate)" htmlFor="crate_size">
                <NumericInput
                  id="crate_size"
                  allowDecimal
                  decimalPlaces={2}
                  value={f.crate_size}
                  onChange={(e) => set("crate_size", e.target.value)}
                />
              </Field>
              <Field
                label="Number of crates"
                htmlFor="crates"
                error={err("crates")}
                hint={
                  s.cratesDerived
                    ? `${kg(num(f.total_weight))} ÷ ${kg(num(f.crate_size))} = ${s.exactCrates}`
                    : undefined
                }
              >
                <NumericInput
                  id="crates"
                  allowZero
                  value={s.cratesDerived ? String(s.crates) : f.crates}
                  readOnly={s.cratesDerived}
                  onChange={(e) => set("crates", e.target.value)}
                  className={cn(s.cratesDerived && "bg-muted/50")}
                  aria-invalid={!!err("crates")}
                />
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={f.round_crates}
                    onCheckedChange={(v) => set("round_crates", v === true)}
                    disabled={!s.cratesDerived}
                  />
                  Count a part-filled crate as a whole crate
                </label>
              </Field>
              <Field label="Deduction per crate (g)" htmlFor="deduction_g" error={err("deduction_g")} hint="Crate weight and dholta">
                <NumericInput
                  id="deduction_g"
                  allowDecimal
                  decimalPlaces={2}
                  allowZero
                  value={f.deduction_g}
                  onChange={(e) => set("deduction_g", e.target.value)}
                  aria-invalid={!!err("deduction_g")}
                />
              </Field>
              <Readout label="Total deduction" value={kg(s.deductionKg)} hint={`${s.crates} crates × ${num(f.deduction_g)} g`} />
              <Readout label="Net weight" value={kg(s.netKg)} hint="Total weight − deduction" strong />
            </CardContent>
          </Card>

          {/* ── Price, discount and what was received ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price and payment</CardTitle>
              <CardDescription>Enter either the discount or the final amount; the other is worked out.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Price per kg" htmlFor="price" error={err("price")}>
                <NumericInput
                  id="price"
                  allowDecimal
                  decimalPlaces={2}
                  value={f.price}
                  onChange={(e) => set("price", e.target.value)}
                  aria-invalid={!!err("price")}
                />
              </Field>
              <Readout label="Total amount" value={formatMoney(s.total)} hint={`${kg(s.netKg)} × ${formatMoney(num(f.price))}`} />
              <Field label="Discount" htmlFor="discount" error={err("discount")}>
                <NumericInput
                  id="discount"
                  allowDecimal
                  decimalPlaces={2}
                  allowZero
                  value={f.discount}
                  onChange={(e) => {
                    setFinalDraft(null);
                    set("discount", e.target.value);
                  }}
                  aria-invalid={!!err("discount")}
                />
              </Field>
              <Field label="Final amount" htmlFor="final" hint="What the buyer pays after the discount">
                <NumericInput
                  id="final"
                  allowDecimal
                  decimalPlaces={2}
                  allowZero
                  value={finalDraft ?? (s.total > 0 ? String(s.final) : "")}
                  onChange={(e) => onFinalChange(e.target.value)}
                  onBlur={() => setFinalDraft(null)}
                  disabled={s.total <= 0}
                />
              </Field>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label id="payment-label">Payment status</Label>
                <Segmented
                  labelledBy="payment-label"
                  options={SALE_PAYMENT_STATUSES.map((p) => ({ value: p, label: PAYMENT_LABELS[p] }))}
                  value={f.payment}
                  onChange={(v) => set("payment", v as SalePaymentStatus)}
                />
              </div>
              {f.payment === "PARTIAL" && (
                <>
                  <Field label="Amount paid" htmlFor="received" error={err("received")} hint="Received now">
                    <NumericInput
                      id="received"
                      allowDecimal
                      decimalPlaces={2}
                      value={f.received}
                      onChange={(e) => {
                        setDueDraft(null);
                        set("received", e.target.value);
                      }}
                      aria-invalid={!!err("received")}
                    />
                  </Field>
                  <Field label="Amount due" htmlFor="due" hint="Still owed by the buyer">
                    <NumericInput
                      id="due"
                      allowDecimal
                      decimalPlaces={2}
                      allowZero
                      value={dueDraft ?? (f.received !== "" ? String(s.due) : "")}
                      onChange={(e) => {
                        // the other direction of the same split: paid = final − due
                        setDueDraft(e.target.value);
                        const paid = Math.round((s.final - num(e.target.value)) * 100) / 100;
                        set("received", e.target.value === "" || paid <= 0 ? "" : String(paid));
                      }}
                      onBlur={() => setDueDraft(null)}
                      disabled={s.final <= 0}
                    />
                  </Field>
                </>
              )}
              {f.payment !== "DUE" && (
                <Field label="Received into" htmlFor="account" error={err("account")}>
                  <FarmAccountSelect id="account" value={f.account} onChange={(v) => set("account", v)} invalid={!!err("account")} />
                </Field>
              )}
            </CardContent>
          </Card>

          {/* ── Outside help for the loading ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loading labour</CardTitle>
              <CardDescription>
                Outside help hired to catch and load. Booked as a labour expense on this batch.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.labour_on} onCheckedChange={(v) => set("labour_on", v === true)} />
                Outside labour was hired for this load
              </label>
              {f.labour_on && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Labour cost" htmlFor="labour_cost" error={err("labour_cost")}>
                    <NumericInput
                      id="labour_cost"
                      allowDecimal
                      decimalPlaces={2}
                      value={f.labour_cost}
                      onChange={(e) => set("labour_cost", e.target.value)}
                      aria-invalid={!!err("labour_cost")}
                    />
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 text-sm sm:mt-7">
                      <Checkbox checked={f.labour_paid} onCheckedChange={(v) => set("labour_paid", v === true)} />
                      Paid on the spot
                    </label>
                  </div>
                  {f.labour_paid && (
                    <Field label="Paid from" htmlFor="labour_account" error={err("labour_account")}>
                      <FarmAccountSelect
                        id="labour_account"
                        value={f.labour_account}
                        onChange={(v) => set("labour_account", v)}
                        invalid={!!err("labour_account")}
                      />
                    </Field>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <SaleSlip
          f={f}
          s={s}
          batchCode={batch?.batch_code}
          houseName={f.houses.map((h) => houseNameOf(h.house_id)).filter(Boolean).join(", ") || undefined}
          saving={saving}
          onSaveAnother={() => submit(true)}
          onCancel={() => navigate("/sales?tab=birds")}
        />
      </form>
    </div>
  );
}

/** The live weighing slip: the same arithmetic the buyer and the shed agree on, line by line. */
function SaleSlip({
  f,
  s,
  batchCode,
  houseName,
  saving,
  onSaveAnother,
  onCancel,
}: {
  f: Form;
  s: SaleFigures;
  batchCode?: string;
  houseName?: string;
  saving: boolean;
  onSaveAnother: () => void;
  onCancel: () => void;
}) {
  const birds = num(f.birds);
  return (
    <aside className="lg:sticky lg:top-4" aria-label="Sale summary">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sale slip</CardTitle>
          <CardDescription>
            {batchCode ? `${batchCode}${houseName ? `, ${houseName}` : ""}` : "Choose a batch to begin"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
            <SlipRow label="Total weight" value={kg(num(f.total_weight))} />
            <SlipRow
              label={`Deduction (${s.crates} crates${s.cratesDerived && s.exactCrates !== s.crates ? (f.round_crates ? ", rounded up" : ", part crate left out") : ""})`}
              value={`− ${kg(s.deductionKg)}`}
              muted
            />
            <SlipRow label="Net weight" value={kg(s.netKg)} strong />
            <SlipRow label="Price per kg" value={`× ${formatMoney(num(f.price))}`} muted />
            <Separator className="my-1" />
            <SlipRow label="Total amount" value={formatMoney(s.total)} />
            {s.discount > 0 && <SlipRow label="Discount" value={`− ${formatMoney(s.discount)}`} muted />}
          </dl>

          <div className="rounded-lg bg-muted/60 p-3">
            <div className="text-xs text-muted-foreground">Final amount</div>
            <div className="text-3xl font-semibold tabular-nums">{formatMoney(s.final)}</div>
            <div className="mt-1">
              <StatusBadge tone={PAYMENT_TONE[f.payment]} label={PAYMENT_LABELS[f.payment]} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm tabular-nums">
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd className="font-medium">{formatMoney(s.received)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Due</dt>
                <dd className="font-medium">{formatMoney(s.due)}</dd>
              </div>
            </dl>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums">
            <div>
              <dt className="text-xs text-muted-foreground">Birds</dt>
              <dd className="font-medium">
                {birds > 0 ? birds.toLocaleString() : "—"}
                {(f.male !== "" || f.female !== "") && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {num(f.male)} male, {num(f.female)} female
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Average weight</dt>
              <dd className="font-medium">{s.avgWeightG !== null ? `${s.avgWeightG.toLocaleString()} g` : "—"}</dd>
            </div>
            {f.labour_on && num(f.labour_cost) > 0 && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Loading labour (batch expense)</dt>
                <dd className="font-medium">
                  {formatMoney(num(f.labour_cost))}
                  <span className="font-normal text-muted-foreground">{f.labour_paid ? ", paid" : ", unpaid"}</span>
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Recording…" : "Record sale"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={onSaveAnother}>
              Record and start another load
            </Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function SlipRow({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", muted && "text-muted-foreground", strong && "font-medium")}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
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
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
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

/** A worked-out figure shown in the form's flow, so the reader sees it where it comes from. */
function Readout({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <span className="text-sm font-medium">{label}</span>
      <div
        className={cn(
          "flex h-8 items-center rounded-lg border border-dashed px-2.5 text-sm tabular-nums",
          strong && "font-semibold",
        )}
      >
        {value}
      </div>
      {hint && <p className="text-xs text-muted-foreground tabular-nums">{hint}</p>}
    </div>
  );
}

/** A one-of-few choice shown all at once (grade, payment status) instead of hidden in a dropdown. */
function Segmented({
  options,
  value,
  onChange,
  labelledBy,
  invalid,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  labelledBy: string;
  invalid?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid}
      className={cn("inline-flex w-fit flex-wrap gap-1 rounded-lg border p-1", invalid && "border-destructive")}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

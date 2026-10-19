import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowDownLeft, ArrowUpRight, Banknote, HandCoins, Landmark, Receipt, Scale, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { cn, daysAgoMs, formatDate, formatMoney } from "@/lib/utils";
import type { Payment, PaymentInstrument } from "@/pages/payments/types";
import type { FinanceMonth, FinanceOwed, FinancePeriod, FinanceSummary, FinancialDashboard, OwedSide } from "@/pages/finance/types";
import { CashFlowChart, CostBreakdownChart, ProfitTrendChart } from "@/pages/finance/finance-charts";

// ── period ─────────────────────────────────────────────────────────────────────
type Preset = "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";
const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));

type Period = { from: string; to: string; compareFrom?: string; compareTo?: string; compareLabel: string };

/** Each preset brings the comparison that makes sense for it: a month so far is compared with the same days of
 * last month, not all of it; a whole period with the one before it. */
function periodFor(preset: Preset, custom: { from: string; to: string }): Period {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const day = now.getUTCDate();
  const fmt = (d: Date, withYear = false) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(withYear && { year: "numeric" }), timeZone: "UTC" });
  const monthName = (d: Date) => d.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
  switch (preset) {
    case "this_month": {
      const prevEnd = Math.min(day, utc(y, m, 0).getUTCDate());
      const cf = utc(y, m - 1, 1);
      const ct = utc(y, m - 1, prevEnd);
      return { from: iso(utc(y, m, 1)), to: iso(now), compareFrom: iso(cf), compareTo: iso(ct), compareLabel: `${fmt(cf)}–${fmt(ct)}` };
    }
    case "last_month": {
      const before = utc(y, m - 2, 1);
      return {
        from: iso(utc(y, m - 1, 1)),
        to: iso(utc(y, m, 0)),
        compareFrom: iso(before),
        compareTo: iso(utc(y, m - 1, 0)),
        compareLabel: monthName(before),
      };
    }
    case "last_3_months":
      return { from: iso(utc(y, m - 2, 1)), to: iso(now), compareLabel: "the 3 months before" };
    case "this_year": {
      return {
        from: iso(utc(y, 0, 1)),
        to: iso(now),
        compareFrom: iso(utc(y - 1, 0, 1)),
        compareTo: iso(utc(y - 1, m, day)),
        compareLabel: `${fmt(utc(y - 1, 0, 1))}–${fmt(utc(y - 1, m, day), true)}`,
      };
    }
    case "custom":
      return { from: custom.from, to: custom.to, compareLabel: "the period before" };
  }
}

/** "▲ 12% vs September" -- a change, in words and an arrow, never colour alone. */
function change(cur: number, prev: number, label: string): string {
  if (prev === 0 && cur === 0) return `No change vs ${label}`;
  if (prev === 0) return `Nothing in ${label}`;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return `About the same as ${label}`;
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}% vs ${label}`;
}

// ── page ───────────────────────────────────────────────────────────────────────
export function OverviewTab() {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [custom, setCustom] = useState(() => {
    const now = new Date();
    return { from: iso(utc(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: iso(now) };
  });
  const period = periodFor(preset, custom);
  const validCustom = preset !== "custom" || (!!custom.from && !!custom.to && custom.from <= custom.to);

  const query = new URLSearchParams({ from: period.from, to: period.to });
  if (period.compareFrom && period.compareTo) {
    query.set("compare_from", period.compareFrom);
    query.set("compare_to", period.compareTo);
  }
  const summary = useGetData<FinanceSummary>(`/analytics/finance/summary?${query}`, ["analytics", "finance", "summary", String(query)], {
    enabled: validCustom,
  });
  const monthly = useGetData<FinanceMonth[]>("/analytics/finance/monthly?months=12", ["analytics", "finance", "monthly"]);
  const owed = useGetData<FinanceOwed>("/analytics/finance/owed?top=5", ["analytics", "finance", "owed"]);

  const cur = summary.data?.current;
  const prev = summary.data?.previous;
  const loading = summary.isLoading || !validCustom;
  const tile = (pick: (p: FinancePeriod) => number) => (cur ? formatMoney(pick(cur)) : "—");
  const hint = (pick: (p: FinancePeriod) => number) => (cur && prev ? change(pick(cur), pick(prev), period.compareLabel) : undefined);

  return (
    <div className="flex flex-col gap-6">
      {/* One row of controls above everything they drive. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground" id="period-label">
            Period
          </span>
          {/* Five choices don't fit a phone's width as buttons: a dropdown there, buttons from tablet up. */}
          <Select value={preset} onValueChange={(v) => setPreset((v as Preset) ?? "this_month")}>
            <SelectTrigger className="w-44 sm:hidden" aria-labelledby="period-label">
              <SelectValue>{(v: Preset) => PRESETS.find((p) => p.value === v)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)} aria-labelledby="period-label" className="hidden sm:flex">
            <TabsList>
              {PRESETS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {preset === "custom" ? (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fin_from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input id="fin_from" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fin_to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input id="fin_to" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDate(period.from)} – {formatDate(period.to)}, compared with {period.compareLabel}
          </p>
        )}
      </div>

      {/* Am I making money, do I have cash, who owes whom */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard label="Cash in accounts" value={tile((p) => p.cash)} icon={Wallet} isLoading={loading} isError={summary.isError} hint={hint((p) => p.cash)} tone={cur && cur.cash < 0 ? "critical" : undefined} />
        <KPICard label="Revenue" value={tile((p) => p.revenue)} icon={TrendingUp} isLoading={loading} isError={summary.isError} hint={hint((p) => p.revenue)} />
        <KPICard label="Costs" value={tile((p) => p.costs)} icon={Receipt} isLoading={loading} isError={summary.isError} hint={hint((p) => p.costs)} />
        <KPICard
          label="Net profit"
          value={tile((p) => p.net_profit)}
          icon={Scale}
          isLoading={loading}
          isError={summary.isError}
          tone={cur && cur.net_profit < 0 ? "critical" : undefined}
          hint={cur ? `${cur.margin === null ? "No revenue" : `${(cur.margin * 100).toFixed(0)}% margin`}. ${hint((p) => p.net_profit) ?? ""}` : undefined}
        />
        <KPICard label="Customers owe us" value={tile((p) => p.receivables)} icon={HandCoins} isLoading={loading} isError={summary.isError} hint={hint((p) => p.receivables)} />
        <KPICard label="We owe" value={tile((p) => p.payables)} icon={Banknote} isLoading={loading} isError={summary.isError} hint={hint((p) => p.payables)} />
      </div>

      {/* Am I making money over time, and where does it go */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ProfitTrendChart rows={monthly.data ?? []} isLoading={monthly.isLoading} />
        <CostBreakdownChart lines={cur?.cost_breakdown ?? []} isLoading={loading} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CashFlowChart rows={monthly.data ?? []} isLoading={monthly.isLoading} />
        <AccountsCard />
      </div>

      {/* Who owes whom: the to-do list */}
      <div className="grid gap-4 lg:grid-cols-2">
        <OwedCard
          title="Customers owe us"
          description="Unpaid sales and bird sales, by how long they've been open"
          side={owed.data?.receivables}
          isLoading={owed.isLoading}
          link={(id) => (id === "walk-in" ? null : `/customers/${id}`)}
          emptyText="Every sale is paid up."
        />
        <OwedCard
          title="We owe"
          description="Unpaid purchases and expenses, by how long they've been open"
          side={owed.data?.payables}
          isLoading={owed.isLoading}
          link={(id) => (id.startsWith("expense:") ? "/finance?tab=expenses" : id === "no-supplier" ? "/purchases" : `/suppliers/${id}`)}
          emptyText="Nothing is owed to suppliers or for expenses."
        />
      </div>

      <RecentMovementsCard />
    </div>
  );
}

// ── accounts ───────────────────────────────────────────────────────────────────
function AccountsCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useGetData<FinancialDashboard>("/analytics/financial", ["analytics", "financial", "now"]);
  const accounts = data?.cash_by_instrument ?? [];
  const total = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Farm accounts</CardTitle>
        <CardDescription>Balance in each account right now</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : accounts.length === 0 ? (
          <EmptyState icon={Landmark} title="No farm accounts yet" action={{ label: "Add an account", onClick: () => navigate("/payments?tab=instruments") }} />
        ) : (
          <ul className="flex flex-col divide-y">
            {accounts.map((a) => {
              const balance = parseFloat(a.balance);
              return (
                <li key={a.instrument_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <Landmark className="size-4 text-muted-foreground" aria-hidden />
                    {a.label}
                  </span>
                  <span className={cn("font-medium tabular-nums", balance < 0 && "text-critical")}>{formatMoney(balance)}</span>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 pt-2.5 text-sm font-semibold">
              <span>Total</span>
              <span className={cn("tabular-nums", total < 0 && "text-critical")}>{formatMoney(total)}</span>
            </li>
          </ul>
        )}
        <Link to="/payments?tab=instruments" className="mt-3 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
          Manage accounts
        </Link>
      </CardContent>
    </Card>
  );
}

// ── owed ───────────────────────────────────────────────────────────────────────
const AGE_BANDS: { key: keyof OwedSide["buckets"]; label: string; shade: string }[] = [
  { key: "d0_30", label: "Up to 30 days", shade: "bg-foreground/25" },
  { key: "d31_60", label: "31–60 days", shade: "bg-foreground/55" },
  { key: "d60_plus", label: "Over 60 days", shade: "bg-foreground/85" },
];

function OwedCard({
  title,
  description,
  side,
  isLoading,
  link,
  emptyText,
}: {
  title: string;
  description: string;
  side?: OwedSide;
  isLoading: boolean;
  link: (id: string) => string | null;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {side && <span className="text-xl font-semibold tabular-nums">{formatMoney(side.total)}</span>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !side || side.total <= 0 ? (
          <EmptyState icon={HandCoins} title="All settled" description={emptyText} />
        ) : (
          <>
            {/* Older is darker: one hue, light to dark, with every band labelled. */}
            <div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Amount owed by age">
                {AGE_BANDS.map((b) =>
                  side.buckets[b.key] > 0 ? (
                    <div key={b.key} className={b.shade} style={{ width: `${(side.buckets[b.key] / side.total) * 100}%` }} />
                  ) : null,
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                {AGE_BANDS.map((b) => (
                  <div key={b.key}>
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("size-2 rounded-full", b.shade)} aria-hidden />
                      {b.label}
                    </dt>
                    <dd className={cn("mt-0.5 text-sm font-medium tabular-nums", b.key === "d60_plus" && side.buckets.d60_plus > 0 && "text-critical")}>
                      {formatMoney(side.buckets[b.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {side.top.map((row) => {
                const days = Math.floor((daysAgoMs(0) - new Date(row.oldest).getTime()) / 86_400_000);
                const href = link(row.id);
                const body = (
                  <>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.records} unpaid, oldest {days} day{days === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatMoney(row.due)}</span>
                  </>
                );
                return (
                  <li key={row.id}>
                    {href ? (
                      <Link to={href} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-3 px-3 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {side.count > side.top.length && (
              <p className="text-xs text-muted-foreground">
                Showing the {side.top.length} largest of {side.count}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── recent movements ───────────────────────────────────────────────────────────
const REF_LABEL: Record<string, string> = { SALE: "Sale", BIRD_SALE: "Bird sale", PURCHASE: "Purchase", EXPENSE: "Expense", PAYROLL: "Payroll" };
const refHref = (p: Payment) =>
  p.ref_type === "SALE"
    ? `/sales/${p.ref_id}`
    : p.ref_type === "BIRD_SALE"
      ? `/sales/birds/${p.ref_id}`
      : p.ref_type === "PURCHASE"
        ? `/purchases/${p.ref_id}`
        : p.ref_type === "EXPENSE"
          ? "/finance?tab=expenses"
          : null;

function RecentMovementsCard() {
  const { data, isLoading } = useGetData<Paginated<Payment>>("/payments?limit=10", ["payments", "recent"]);
  const { data: accounts } = useGetData<Paginated<PaymentInstrument>>("/payment-instruments?limit=100", ["payment-instruments", "all"]);
  const accountName = (p: Payment) => accounts?.results.find((a) => a.id === (p.to_instrument_id ?? p.from_instrument_id))?.label ?? "—";
  const payments = data?.results ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Recent money movements</CardTitle>
          <CardDescription>The last 10 payments in and out</CardDescription>
        </div>
        <Link to="/payments" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          All payments
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : payments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" />
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {payments.map((p) => {
              const incoming = p.direction === "INCOMING";
              const href = refHref(p);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", incoming ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                      {incoming ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">
                        {incoming ? "Received" : "Paid"} for{" "}
                        {href ? (
                          <Link to={href} className="font-medium underline-offset-4 hover:underline">
                            {REF_LABEL[p.ref_type] ?? p.ref_type}
                          </Link>
                        ) : (
                          <span className="font-medium">{REF_LABEL[p.ref_type] ?? p.ref_type}</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(p.payment_date)}, {incoming ? "into" : "from"} {accountName(p)}
                        {p.transaction_ref ? `, ref ${p.transaction_ref}` : ""}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {incoming ? "+" : "−"}
                    {formatMoney(p.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

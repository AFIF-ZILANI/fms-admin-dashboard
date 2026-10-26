import { useState } from "react";
import { Link } from "react-router";
import { BarChart3, CircleCheck, CreditCard, Layers, Plus, Receipt, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipValueType } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, OTHER_COLOR, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import { ExpenseCreateDialog } from "@/pages/finance/expense-create-dialog";
import { EXPENSE_COST_TYPES, type Expense, type ExpenseSummary } from "@/pages/finance/types";

/** Wage and fee expenses are paid by their payroll payout, never by a payment here. */
const PAYROLL_CATEGORIES = ["SALARY", "FESTIVAL_BONUS", "SALARY_TRANSFER_FEE"];
const COST_TYPE_LABEL: Record<string, string> = {
  DIRECT: "Batch",
  SHARED_PERIOD: "Farm-wide",
  SHARED_CAPITAL: "Capital",
  STOCK: "Purchase charge",
};
import type { LookupRow } from "@/pages/settings/lookup-types";

export function ExpensesTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [payExpenseId, setPayExpenseId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("ALL");
  const [costType, setCostType] = useState<string>("ALL");
  const [batchId, setBatchId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (category !== "ALL") query.set("category", category);
  if (costType !== "ALL") query.set("cost_type", costType);
  if (batchId !== "ALL") query.set("batch_id", batchId);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);

  const { data, isLoading } = useGetData<Paginated<Expense>>(`/expenses?${query}`, [
    "expenses",
    category,
    costType,
    batchId,
    dateFrom,
    dateTo,
  ]);
  // Totals for the whole filtered set, not just the 100 rows on screen.
  const summaryQuery = new URLSearchParams(query);
  summaryQuery.delete("limit");
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useGetData<ExpenseSummary>(
    `/expenses/summary?${summaryQuery}`,
    ["expenses", "summary", String(summaryQuery)],
  );
  const { trueAmounts } = useOutstanding("EXPENSE");
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/expense-categories?active=true&limit=100",
    ["expense-categories", "active"]
  );
  const categoryLabel = (code: string) => categories?.results.find((c) => c.code === code)?.label ?? humanizeEnum(code);
  const batchCode = (id: string) => batches?.results.find((b) => b.id === id)?.batch_code ?? "—";
  const owed = (e: Expense) => (PAYROLL_CATEGORIES.includes(e.category) ? 0 : parseFloat(trueAmounts(e.id, "0", e.amount).due));

  const expenses = data?.results ?? [];
  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", render: (e) => formatDate(e.date), sortValue: (e) => e.date },
    { key: "category", header: "Category", render: (e) => categoryLabel(e.category), sortValue: (e) => categoryLabel(e.category) },
    {
      key: "charged_to",
      header: "Charged to",
      render: (e) =>
        e.batch_id ? (
          <Link to={`/batches/${e.batch_id}`} onClick={(ev) => ev.stopPropagation()} className="font-medium underline-offset-4 hover:underline">
            {batchCode(e.batch_id)}
          </Link>
        ) : (
          <span className="text-muted-foreground">{COST_TYPE_LABEL[e.cost_type] ?? humanizeEnum(e.cost_type)}</span>
        ),
    },
    { key: "amount", header: "Amount", render: (e) => formatMoney(e.amount), numeric: true, sortValue: (e) => parseFloat(e.amount) },
    {
      key: "payment",
      header: "Payment",
      render: (e) => {
        if (PAYROLL_CATEGORIES.includes(e.category)) return <span className="text-xs text-muted-foreground">Via payroll</span>;
        const due = owed(e);
        const amount = parseFloat(e.amount);
        return due <= 0 ? (
          <StatusBadge tone="success" label="Paid" />
        ) : due < amount ? (
          <StatusBadge tone="warning" label={`${formatMoney(due)} due`} />
        ) : (
          <StatusBadge tone="neutral" label="Unpaid" />
        );
      },
      sortValue: (e) => owed(e),
    },
    { key: "remarks", header: "Remarks", render: (e) => <span className="line-clamp-1 text-muted-foreground">{e.remarks ?? "—"}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (e) => {
        const due = owed(e);
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={due <= 0}
            aria-label={due <= 0 ? "Nothing to pay" : "Record payment"}
            title={PAYROLL_CATEGORIES.includes(e.category) ? "Paid through payroll" : due <= 0 ? "Fully paid" : "Record payment"}
            onClick={(ev) => {
              ev.stopPropagation();
              setPayExpenseId(e.id);
            }}
          >
            <CreditCard />
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-category-filter">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? "ALL")}>
            <SelectTrigger id="expense-category-filter" className="w-40">
              <SelectValue>
                {(v: string) =>
                  v === "ALL" ? "All categories" : (categories?.results.find((c) => c.code === v)?.label ?? humanizeEnum(v))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {(categories?.results ?? []).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-cost-type-filter">Cost type</Label>
          <Select value={costType} onValueChange={(v) => setCostType(v ?? "ALL")}>
            <SelectTrigger id="expense-cost-type-filter" className="w-40">
              <SelectValue>{(v: string) => (v === "ALL" ? "All cost types" : (COST_TYPE_LABEL[v] ?? humanizeEnum(v)))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All cost types</SelectItem>
              {EXPENSE_COST_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {COST_TYPE_LABEL[c] ?? humanizeEnum(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-batch-filter">Batch</Label>
          <Select value={batchId} onValueChange={(v) => setBatchId(v ?? "ALL")}>
            <SelectTrigger id="expense-batch-filter" className="w-40">
              <SelectValue>
                {(v: string) => (v === "ALL" ? "All batches" : batches?.results.find((b) => b.id === v)?.batch_code ?? "—")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All batches</SelectItem>
              {(batches?.results ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batch_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date-from">From</Label>
          <Input id="date-from" type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date-to">To</Label>
          <Input id="date-to" type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(category !== "ALL" || costType !== "ALL" || batchId !== "ALL" || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("ALL");
              setCostType("ALL");
              setBatchId("ALL");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total spent"
          value={summary ? formatMoney(summary.total) : "—"}
          icon={Wallet}
          isLoading={summaryLoading}
          isError={summaryError}
          hint={
            summary
              ? `${summary.count.toLocaleString()} expense${summary.count === 1 ? "" : "s"}` +
                (summary.stock > 0 ? ` · ${formatMoney(summary.stock)} purchase charges (in stock cost)` : "")
              : undefined
          }
        />
        <KPICard
          label="Still to pay"
          value={summary ? formatMoney(summary.unpaid) : "—"}
          icon={CreditCard}
          isLoading={summaryLoading}
          isError={summaryError}
          tone={summary && summary.unpaid > 0 ? "warning" : undefined}
          hint={summary ? `${formatMoney(summary.paid)} paid` : undefined}
        />
        <KPICard
          label="Charged to batches"
          value={summary ? formatMoney(summary.direct) : "—"}
          icon={Receipt}
          isLoading={summaryLoading}
          isError={summaryError}
          hint="Counted in that batch's P&L"
        />
        <KPICard
          label="Farm-wide"
          value={summary ? formatMoney(summary.shared + summary.capital) : "—"}
          icon={Layers}
          isLoading={summaryLoading}
          isError={summaryError}
          hint={summary && summary.capital > 0 ? `${formatMoney(summary.capital)} of it capital` : "Shared across batches by bird-days"}
        />
      </div>

      <ByCategoryChart summary={summary} isLoading={summaryLoading} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {data && data.total > expenses.length ? `Newest ${expenses.length} of ${data.total}` : "Newest first"}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Record expense
            </Button>
          </div>
      <DataTable
        columns={columns}
        rows={expenses}
        totalCount={data?.total}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: Receipt,
          title: "No expenses recorded yet",
          description: "Record labor, utilities, or other farm costs.",
          action: { label: "Record expense", onClick: () => setCreateOpen(true) },
        }}
      />

        </div>
      </div>

      <ExpenseCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PaymentCreateDialog
        open={payExpenseId !== null}
        onOpenChange={(open) => !open && setPayExpenseId(null)}
        defaultRefType="EXPENSE"
        defaultRefId={payExpenseId ?? undefined}
      />
    </div>
  );
}

const TOP_CATEGORIES = 8;

/** Spend by category for the filtered set, largest first, one series; the tail folds into "Other". */
function ByCategoryChart({ summary, isLoading }: { summary?: ExpenseSummary; isLoading: boolean }) {
  const all = summary?.by_category ?? [];
  const rows: { label: string; amount: number; other: boolean }[] = all.slice(0, TOP_CATEGORIES).map((c) => ({ label: c.label, amount: c.amount, other: false }));
  const rest = all.slice(TOP_CATEGORIES).reduce((a, c) => a + c.amount, 0);
  if (rest > 0) rows.push({ label: "Other", amount: rest, other: true });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">By category</CardTitle>
        <CardDescription>For the filters above</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />
        ) : rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No expenses for these filters" />
        ) : (
          <ResponsiveContainer width="100%" height={rows.length * 28 + 24}>
            <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 64 }}>
              <CartesianGrid {...chartGridProps} vertical horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={120} {...chartAxisProps} />
              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: TooltipValueType | undefined) => {
                  const n = typeof v === "number" ? v : Number(v);
                  return [`${formatMoney(n)} (${summary && summary.total ? ((n / summary.total) * 100).toFixed(0) : 0}%)`, "Spent"];
                }}
              />
              <Bar
                dataKey="amount"
                radius={[0, 4, 4, 0]}
                maxBarSize={16}
                shape={(props: unknown) => {
                  const p = props as { x: number; y: number; width: number; height: number; payload: { other: boolean } };
                  return <rect x={p.x} y={p.y} width={Math.max(0, p.width)} height={p.height} rx={4} fill={p.payload.other ? OTHER_COLOR : SINGLE_SERIES_STROKE} />;
                }}
                label={{ position: "right", fontSize: 12, fill: "var(--color-muted-foreground)", formatter: (v: unknown) => formatMoney(Number(v)) }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        {summary && summary.unpaid === 0 && summary.count > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
            <CircleCheck className="size-3.5" aria-hidden /> Everything here is paid
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import { ExpenseCreateDialog } from "@/pages/finance/expense-create-dialog";
import { COST_TYPES, type Expense } from "@/pages/finance/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

export function ExpensesTab() {
  const [createOpen, setCreateOpen] = useState(false);
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
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/expense-categories?active=true&limit=100",
    ["expense-categories", "active"]
  );
  const batchCode = (id: string | null) => (id ? batches?.results.find((b) => b.id === id)?.batch_code ?? "—" : "Farm-wide");

  const expenses = data?.results ?? [];
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const directTotal = expenses.filter((e) => e.cost_type === "DIRECT").reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", render: (e) => new Date(e.date).toLocaleDateString() },
    { key: "category", header: "Category", render: (e) => humanizeEnum(e.category) },
    { key: "cost_type", header: "Cost type", render: (e) => humanizeEnum(e.cost_type) },
    { key: "batch", header: "Batch", render: (e) => batchCode(e.batch_id) },
    { key: "amount", header: "Amount", render: (e) => formatMoney(e.amount), numeric: true },
    { key: "remarks", header: "Remarks", render: (e) => e.remarks ?? "—" },
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
              <SelectValue>{(v: string) => (v === "ALL" ? "All cost types" : humanizeEnum(v))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All cost types</SelectItem>
              {COST_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {humanizeEnum(c)}
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total expenses" value={data?.total ?? expenses.length} icon={Receipt} isLoading={isLoading} />
        <KPICard label="Total amount" value={formatMoney(total)} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Direct (batch) amount" value={formatMoney(directTotal)} icon={Wallet} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record expense
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={expenses}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: Receipt,
          title: "No expenses recorded yet",
          description: "Record labor, utilities, or other farm costs.",
          action: { label: "Record expense", onClick: () => setCreateOpen(true) },
        }}
      />

      <ExpenseCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

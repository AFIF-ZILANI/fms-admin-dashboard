import { useState } from "react";
import { Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import { ExpenseCreateDialog } from "@/pages/finance/expense-create-dialog";
import type { Expense } from "@/pages/finance/types";

export function ExpensesTab() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Expense>>("/expenses?limit=100", ["expenses"]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
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

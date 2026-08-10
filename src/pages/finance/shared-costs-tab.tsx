import { Layers } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Expense } from "@/pages/finance/types";

/** Visibility only -- the bird-days formula that would actually distribute
 * these amounts across concurrent batches is v2, not built yet
 * (system-design-arc.md §7, needs 2-3 batches of real overlapping data to
 * validate against). This tab shows what's waiting; it doesn't decide how
 * to split it. */
export function SharedCostsTab() {
  const { data, isLoading } = useGetData<Paginated<Expense>>("/expenses?cost_type=SHARED_PERIOD&limit=100", [
    "expenses",
    "SHARED_PERIOD",
  ]);

  const expenses = data?.results ?? [];
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", render: (e) => new Date(e.date).toLocaleDateString() },
    { key: "category", header: "Category", render: (e) => humanizeEnum(e.category) },
    { key: "amount", header: "Amount", render: (e) => formatMoney(e.amount), numeric: true },
    { key: "remarks", header: "Remarks", render: (e) => e.remarks ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KPICard label="Unallocated shared-period costs" value={formatMoney(total)} icon={Layers} isLoading={isLoading} />
      </div>

      <p className="text-xs text-muted-foreground">
        Awaiting bird-days allocation — the distribution formula is v2, not yet built. These amounts are visible but
        not yet split across concurrent batches.
      </p>

      <DataTable
        columns={columns}
        rows={expenses}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: Layers,
          title: "No shared-period costs recorded",
          description: "Shared-period expenses appear here once logged from the Expenses tab.",
        }}
      />
    </div>
  );
}

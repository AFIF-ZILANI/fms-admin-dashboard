import { useState } from "react";
import { Bird, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import type { House } from "@/pages/houses/types";
import { BirdSaleCreateDialog } from "@/pages/sales/bird-sale-create-dialog";
import type { BirdSale } from "@/pages/sales/types";

const GRADE_TONE = { HIGH: "success", LOW: "warning", CULL: "critical" } as const;

// ponytail: no dedicated detail page — the table already surfaces every field
// on this append-only, single-row record. Add one if this list needs drilldown.
export function BirdSalesTab() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", ["bird-sales"]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);

  const batchCode = (id: string) => batches?.results.find((b) => b.id === id)?.batch_code ?? "—";
  const houseName = (id: string) => houses?.results.find((h) => h.id === id)?.name ?? "—";
  const customerName = (id: string | null) => customers?.results.find((c) => c.id === id)?.profile.name ?? "—";

  const birdSales = data?.results ?? [];
  const totalRevenue = birdSales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
  const totalDue = birdSales.reduce((sum, s) => sum + parseFloat(s.due_amount), 0);
  const totalBirds = birdSales.reduce((sum, s) => sum + s.birds_count, 0);

  const columns: Column<BirdSale>[] = [
    { key: "date", header: "Date", render: (s) => new Date(s.sale_date).toLocaleDateString() },
    { key: "batch", header: "Batch", render: (s) => batchCode(s.batch_id) },
    { key: "house", header: "House", render: (s) => houseName(s.house_id) },
    { key: "customer", header: "Customer", render: (s) => customerName(s.customer_id) },
    { key: "grade", header: "Grade", render: (s) => <StatusBadge tone={GRADE_TONE[s.grade]} label={s.grade} /> },
    { key: "birds", header: "Birds", render: (s) => s.birds_count, numeric: true },
    { key: "net_weight", header: "Net wt (kg)", render: (s) => s.net_weight, numeric: true },
    { key: "total", header: "Total", render: (s) => formatMoney(s.total_amount), numeric: true },
    { key: "due", header: "Due", render: (s) => formatMoney(s.due_amount), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Birds sold" value={totalBirds} icon={Bird} isLoading={isLoading} />
        <KPICard label="Total revenue" value={formatMoney(totalRevenue)} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Outstanding due" value={formatMoney(totalDue)} icon={Wallet} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record bird sale
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={birdSales}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        empty={{
          icon: Bird,
          title: "No bird sales recorded yet",
          description: "Record your first bird sale from a batch.",
          action: { label: "Record bird sale", onClick: () => setCreateOpen(true) },
        }}
      />

      <BirdSaleCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Sale } from "@/pages/sales/types";
import type { Customer } from "@/pages/customers/types";
import { SaleCreateDialog } from "@/pages/sales/sale-create-dialog";

export function RegularSalesTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"]);
  // Sale's own `customer` relation has no name (see types.ts) — look it up separately.
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const customerName = (id: string | null) => customers?.results.find((c) => c.id === id)?.profile.name ?? "—";

  const sales = data?.results ?? [];
  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total), 0);
  const totalDue = sales.reduce((sum, s) => sum + parseFloat(s.due_amount), 0);

  const columns: Column<Sale>[] = [
    { key: "date", header: "Date", render: (s) => new Date(s.sale_date).toLocaleDateString() },
    { key: "customer", header: "Customer", render: (s) => customerName(s.customer_id) },
    { key: "items", header: "Lines", render: (s) => s.items.length, numeric: true },
    { key: "total", header: "Total", render: (s) => formatMoney(s.total), numeric: true },
    { key: "due", header: "Due", render: (s) => formatMoney(s.due_amount), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total sales" value={data?.total ?? sales.length} icon={Receipt} isLoading={isLoading} />
        <KPICard label="Total revenue" value={formatMoney(totalRevenue)} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Outstanding due" value={formatMoney(totalDue)} icon={Wallet} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record sale
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={sales}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/sales/${s.id}`)}
        empty={{
          icon: Receipt,
          title: "No sales recorded yet",
          description: "Record your first sale to a customer.",
          action: { label: "Record sale", onClick: () => setCreateOpen(true) },
        }}
      />

      <SaleCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

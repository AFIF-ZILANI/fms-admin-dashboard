import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Purchase } from "@/pages/purchases/types";
import type { Supplier } from "@/pages/suppliers/types";
import { PurchaseCreateDialog } from "@/pages/purchases/purchase-create-dialog";

export function PurchasesListPage() {
  usePageTitle("Purchases");
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"]);
  // Purchase's own `supplier` relation has no name (see types.ts) — look it up separately.
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const supplierName = (id: string | null) => suppliers?.results.find((s) => s.id === id)?.profile.name ?? "—";

  const purchases = data?.results ?? [];
  const totalSpent = purchases.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
  const totalDue = purchases.reduce((sum, p) => sum + parseFloat(p.due_amount), 0);

  const columns: Column<Purchase>[] = [
    { key: "date", header: "Date", render: (p) => new Date(p.purchase_date).toLocaleDateString() },
    { key: "supplier", header: "Supplier", render: (p) => supplierName(p.supplier_id) },
    { key: "invoice", header: "Invoice", render: (p) => p.invoice_no ?? "—" },
    { key: "items", header: "Lines", render: (p) => p.items.length, numeric: true },
    { key: "total", header: "Total", render: (p) => formatMoney(p.total_amount), numeric: true },
    { key: "due", header: "Due", render: (p) => formatMoney(p.due_amount), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total purchases" value={data?.total ?? purchases.length} icon={Receipt} isLoading={isLoading} />
        <KPICard label="Total spent" value={formatMoney(totalSpent)} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Outstanding due" value={formatMoney(totalDue)} icon={Wallet} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record purchase
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={purchases}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        onRowClick={(p) => navigate(`/purchases/${p.id}`)}
        empty={{
          icon: Receipt,
          title: "No purchases recorded yet",
          description: "Record your first purchase from a supplier.",
          action: { label: "Record purchase", onClick: () => setCreateOpen(true) },
        }}
      />

      <PurchaseCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

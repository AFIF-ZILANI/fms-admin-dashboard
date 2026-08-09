import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Sale, SaleItemLine } from "@/pages/sales/types";
import type { Customer } from "@/pages/customers/types";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: sale, isLoading } = useGetData<Sale>(`/sales/${id}`, ["sales", id]);
  usePageTitle("Sale");

  // Sale's own `customer` relation has no name (see types.ts) — look it up separately.
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const customerName = customers?.results.find((c) => c.id === sale?.customer_id)?.profile.name;

  const columns: Column<SaleItemLine>[] = [
    { key: "item", header: "Item", render: (l) => l.item.name },
    { key: "quantity", header: "Quantity", render: (l) => `${l.quantity} ${l.unit}`, numeric: true },
    { key: "unit_price", header: "Unit price", render: (l) => formatMoney(l.unit_price), numeric: true },
    { key: "total", header: "Total", render: (l) => formatMoney(l.total_price), numeric: true },
  ];

  if (isLoading || !sale) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales")}>
        <ArrowLeft />
        Back to sales
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sale · {new Date(sale.sale_date).toLocaleDateString()}</CardTitle>
          <p className="text-sm text-muted-foreground">{customerName ?? "No customer on file"}</p>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Sales are append-only — a correction is a new sale, not an edit.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total" value={formatMoney(sale.total)} icon={Receipt} />
        <KPICard label="Paid" value={formatMoney(sale.paid_amount)} icon={Receipt} />
        <KPICard label="Due" value={formatMoney(sale.due_amount)} icon={Receipt} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={sale.items}
            rowKey={(l) => l.id}
            empty={{ icon: Receipt, title: "No line items" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

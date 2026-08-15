import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CreditCard, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { paymentStatus, type Sale, type SaleItemLine } from "@/pages/sales/types";
import type { Customer } from "@/pages/customers/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

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

  const status = paymentStatus(sale.paid_amount, sale.due_amount);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales")}>
        <ArrowLeft />
        Back to sales
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Sale · {new Date(sale.sale_date).toLocaleDateString()}</CardTitle>
            <p className="text-sm text-muted-foreground">{customerName ?? "No customer on file"}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={status.tone} label={status.label} />
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
              <CreditCard />
              Record payment
            </Button>
          </div>
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

      <PaymentCreateDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultRefType="SALE" defaultRefId={sale.id} />
    </div>
  );
}

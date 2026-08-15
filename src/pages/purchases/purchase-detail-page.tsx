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
import { paymentStatus } from "@/pages/sales/types";
import type { Purchase, PurchaseItemLine } from "@/pages/purchases/types";
import type { Supplier } from "@/pages/suppliers/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: purchase, isLoading } = useGetData<Purchase>(`/purchases/${id}`, ["purchases", id]);
  usePageTitle(purchase?.invoice_no ?? "Purchase");

  // Purchase's own `supplier` relation has no name (see types.ts) — look it up separately.
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const supplierName = suppliers?.results.find((s) => s.id === purchase?.supplier_id)?.profile.name;
  const { trueAmounts } = useOutstanding("PURCHASE");

  const columns: Column<PurchaseItemLine>[] = [
    { key: "item", header: "Item", render: (l) => l.item.name },
    { key: "quantity", header: "Quantity", render: (l) => `${l.quantity} ${l.unit}`, numeric: true },
    { key: "unit_price", header: "Unit price", render: (l) => formatMoney(l.unit_price), numeric: true },
    { key: "total", header: "Total", render: (l) => formatMoney(l.total_price), numeric: true },
    { key: "mfg", header: "Mfg date", render: (l) => (l.mfg_date ? new Date(l.mfg_date).toLocaleDateString() : "—") },
    {
      key: "exp",
      header: "Expires",
      render: (l) => (l.expiration_date ? new Date(l.expiration_date).toLocaleDateString() : "—"),
    },
  ];

  if (isLoading || !purchase) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const amounts = trueAmounts(purchase.id, purchase.paid_amount, purchase.due_amount);
  const status = paymentStatus(amounts.paid, amounts.due);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/purchases")}>
        <ArrowLeft />
        Back to purchases
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">{purchase.invoice_no ?? "No invoice number"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {supplierName ?? "No supplier on file"} · {new Date(purchase.purchase_date).toLocaleDateString()}
            </p>
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
          Purchases are append-only — a correction is a new purchase, not an edit.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total" value={formatMoney(purchase.total_amount)} icon={Receipt} />
        <KPICard label="Paid" value={formatMoney(amounts.paid)} icon={Receipt} />
        <KPICard label="Due" value={formatMoney(amounts.due)} icon={Receipt} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={purchase.items}
            rowKey={(l) => l.id}
            empty={{ icon: Receipt, title: "No line items" }}
          />
        </CardContent>
      </Card>

      <PaymentCreateDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultRefType="PURCHASE"
        defaultRefId={purchase.id}
      />
    </div>
  );
}

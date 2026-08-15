import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Bird, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import type { House } from "@/pages/houses/types";
import { paymentStatus, type BirdSale } from "@/pages/sales/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function BirdSaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: sale, isLoading } = useGetData<BirdSale>(`/bird-sales/${id}`, ["bird-sales", id]);
  usePageTitle("Bird sale");

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const { trueAmounts } = useOutstanding("BIRD_SALE");

  const batchCode = batches?.results.find((b) => b.id === sale?.batch_id)?.batch_code;
  const houseName = houses?.results.find((h) => h.id === sale?.house_id)?.name;
  const customerName = customers?.results.find((c) => c.id === sale?.customer_id)?.profile.name;

  if (isLoading || !sale) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const amounts = trueAmounts(sale.id, sale.paid_amount, sale.due_amount);
  const status = paymentStatus(amounts.paid, amounts.due);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales")}>
        <ArrowLeft />
        Back to sales
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Bird sale · {new Date(sale.sale_date).toLocaleDateString()}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {batchCode ?? "—"} · {houseName ?? "—"} · {customerName ?? "No customer on file"}
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
          Sales are append-only — a correction is a new sale, not an edit.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total" value={formatMoney(sale.total_amount)} icon={Bird} />
        <KPICard label="Paid" value={formatMoney(amounts.paid)} icon={Bird} />
        <KPICard label="Due" value={formatMoney(amounts.due)} icon={Bird} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sale details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Grade</dt>
              <dd className="font-medium">{humanizeEnum(sale.grade)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Birds count</dt>
              <dd className="font-medium tabular-nums">{sale.birds_count}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Male / Female</dt>
              <dd className="font-medium tabular-nums">
                {sale.male_count ?? "—"} / {sale.female_count ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dholta (g)</dt>
              <dd className="font-medium tabular-nums">{sale.dholta_in_g}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total katha</dt>
              <dd className="font-medium tabular-nums">{sale.total_katha}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Avg wt / katha (kg)</dt>
              <dd className="font-medium tabular-nums">{sale.avg_wt_per_katha_kg ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total weight (kg)</dt>
              <dd className="font-medium tabular-nums">{sale.total_weight}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Net weight (kg)</dt>
              <dd className="font-medium tabular-nums">{sale.net_weight}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Avg weight (g)</dt>
              <dd className="font-medium tabular-nums">{sale.avg_weight_g ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Price / kg</dt>
              <dd className="font-medium tabular-nums">{formatMoney(sale.price_per_kg)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <PaymentCreateDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultRefType="BIRD_SALE"
        defaultRefId={sale.id}
      />
    </div>
  );
}

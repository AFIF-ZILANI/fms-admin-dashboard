import { useState } from "react";
import { TruncatedText } from "@/components/shared/truncated-text";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, ArrowLeft, CreditCard, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, formatTk, humanizeEnum } from "@/lib/utils";
import { paymentStatus, type SaleDetail, type SoldBottle } from "@/pages/sales/types";
import { SALE_KIND_LABEL } from "@/pages/sales/sale-kinds";
import type { Customer } from "@/pages/customers/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";
import { useFormatStock } from "@/pages/inventory/use-format-stock";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: sale, isLoading, isError } = useGetData<SaleDetail>(`/sales/${id}`, ["sales", id]);
  usePageTitle(sale ? `Sale · ${formatDate(sale.sale_date)}` : "Sale");

  // Sale's own `customer` relation has no name (see types.ts) — look it up separately.
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const customerName = customers?.results.find((c) => c.id === sale?.customer_id)?.profile.name;
  const { trueAmounts } = useOutstanding("SALE");

  const fmt = useFormatStock();
  const coded = sale?.kind === "CODED";
  const columns: Column<SaleDetail["items"][number]>[] = [
    { key: "item", header: "Item", render: (l) => <TruncatedText text={l.item.name} className="max-w-48" /> },
    {
      key: "quantity",
      header: "Quantity",
      // QR lines count packs; the unit only names the pack (Bottle, Pouch), so no conversion applies.
      render: (l) =>
        coded
          ? `${Number(l.quantity)} ${l.unit ? humanizeEnum(l.unit).toLowerCase() : "packs"}`
          : fmt.entered(l.quantity, l.unit ?? l.item.unit, l.item.id),
      numeric: true,
    },
    ...(coded
      ? [
          {
            key: "scanned",
            header: "Scanned",
            render: (l: SaleDetail["items"][number]) => `${l.scanned} of ${Number(l.quantity)}`,
            numeric: true,
          },
        ]
      : []),
    { key: "unit_price", header: "Unit price", render: (l) => formatTk(l.unit_price), numeric: true },
    { key: "total", header: "Total", render: (l) => formatTk(l.total_price), numeric: true },
  ];
  const bottleColumns: Column<SoldBottle>[] = [
    { key: "code", header: "Code", render: (b) => <span className="tabular-nums">…{b.id.slice(-7)}</span> },
    {
      key: "item",
      header: "Item",
      render: (b) => sale?.items.find((l) => l.id === b.line_id)?.item.name ?? "",
    },
    { key: "size", header: "Size", render: (b) => `${Number(b.size)} ${b.unit.toLowerCase()}`, numeric: true },
    { key: "lot", header: "Bought", render: (b) => formatDate(b.lot_date) },
    { key: "by", header: "Scanned by", render: (b) => b.sold_by ?? "" },
    { key: "when", header: "When", render: (b) => formatDate(b.sold_at), sortValue: (b) => b.sold_at },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // `!sale` without an error is a 404 body -- the same dead end as isError, so
  // both land here. The old `isLoading || !sale` guard showed a skeleton forever.
  if (isError || !sale) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales?tab=regular")}>
          <ArrowLeft />
          Back to sales
        </Button>
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load this sale"
          description="It may have been removed, or the link is wrong."
        />
      </div>
    );
  }

  const amounts = trueAmounts(sale.id, sale.paid_amount, sale.due_amount);
  const toScan = sale.items.reduce((sum, l) => sum + Math.max(0, Number(l.quantity) - l.scanned), 0);
  const status = paymentStatus(amounts.paid, amounts.due);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/sales?tab=regular")}>
        <ArrowLeft />
        Back to sales
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Sale · {formatDate(sale.sale_date)}</CardTitle>
            <p className="text-sm text-muted-foreground">{customerName ?? "No customer on file"}</p>
            <p className="text-sm text-muted-foreground">
              {SALE_KIND_LABEL[sale.kind]}
              {sale.warehouse ? ` from ${sale.warehouse.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={status.tone} label={status.label} />
            <Button
              variant="outline"
              size="sm"
              disabled={parseFloat(amounts.due) <= 0}
              title={parseFloat(amounts.due) <= 0 ? "Fully paid" : undefined}
              onClick={() => setPaymentOpen(true)}
            >
              <CreditCard />
              {parseFloat(amounts.due) <= 0 ? "Fully paid" : "Record payment"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Sales are append-only — a correction is a new sale, not an edit.
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total" value={formatTk(sale.total)} icon={Receipt} />
        <KPICard label="Paid" value={formatTk(amounts.paid)} icon={Receipt} />
        <KPICard label="Due" value={formatTk(amounts.due)} icon={Receipt} />
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
          {(sale.discount_type || sale.items.some((l) => l.discount_type)) && (
            <p className="mt-3 text-sm text-muted-foreground tabular-nums">
              Line totals are after their own discounts.
              {sale.discount_type &&
                ` Overall discount ${sale.discount_type === "PERCENT" ? `${Number(sale.discount_value)}%` : formatTk(sale.discount_value ?? 0)}: −${formatTk(
                  sale.items.reduce((sum, l) => sum + Number(l.total_price), 0) - Number(sale.total)
                )}.`}
            </p>
          )}
          {coded && toScan > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {toScan} {toScan === 1 ? "pack" : "packs"} still to scan on the phone.
            </p>
          )}
        </CardContent>
      </Card>

      {coded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scanned packs</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={bottleColumns}
              rows={sale.bottles}
              rowKey={(b) => b.id}
              empty={{
                icon: Receipt,
                title: "No packs scanned yet",
                description: "A manager scans each pack on the phone as it leaves.",
              }}
            />
          </CardContent>
        </Card>
      )}

      <PaymentCreateDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultRefType="SALE" defaultRefId={sale.id} />
    </div>
  );
}

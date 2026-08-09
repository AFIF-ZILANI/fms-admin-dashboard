import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Receipt, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Customer } from "@/pages/customers/types";
import { CustomerFormDialog } from "@/pages/customers/customer-form-dialog";

type Sale = { id: string; sale_date: string; total: string; paid_amount: string; due_amount: string };
type BirdSale = { id: string; sale_date: string; total_amount: string; paid_amount: string; due_amount: string };

type SaleRow = { id: string; type: "Regular" | "Bird"; date: string; total: number; paid: number; due: number };

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading } = useGetData<Customer>(`/customers/${id}`, ["customers", id]);
  usePageTitle(customer?.profile.name ?? "Customer");

  const { data: sales } = useGetData<Paginated<Sale>>(`/sales?customer_id=${id}&limit=100`, [
    "sales",
    "customer",
    id,
  ]);
  const { data: birdSales } = useGetData<Paginated<BirdSale>>(`/bird-sales?customer_id=${id}&limit=100`, [
    "bird-sales",
    "customer",
    id,
  ]);

  const deactivate = usePostData<Customer, void>(`/customers/${id}/deactivate`, ["customers"]);
  const reactivate = usePostData<Customer, void>(`/customers/${id}/reactivate`, ["customers"]);

  const toggleActive = () => {
    const mutation = customer?.is_active ? deactivate : reactivate;
    mutation.mutate(undefined, {
      onSuccess: () => toast.success(customer?.is_active ? "Customer deactivated" : "Customer reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const saleRows: SaleRow[] = [
    ...(sales?.results ?? []).map((s) => ({
      id: s.id,
      type: "Regular" as const,
      date: s.sale_date,
      total: parseFloat(s.total),
      paid: parseFloat(s.paid_amount),
      due: parseFloat(s.due_amount),
    })),
    ...(birdSales?.results ?? []).map((s) => ({
      id: s.id,
      type: "Bird" as const,
      date: s.sale_date,
      total: parseFloat(s.total_amount),
      paid: parseFloat(s.paid_amount),
      due: parseFloat(s.due_amount),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSold = saleRows.reduce((sum, r) => sum + r.total, 0);
  const totalReceivable = saleRows.reduce((sum, r) => sum + r.due, 0);

  const saleColumns: Column<SaleRow>[] = [
    { key: "date", header: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
    { key: "type", header: "Type", render: (r) => r.type },
    { key: "total", header: "Total", render: (r) => formatMoney(r.total), numeric: true },
    { key: "paid", header: "Paid", render: (r) => formatMoney(r.paid), numeric: true },
    { key: "due", header: "Due", render: (r) => formatMoney(r.due), numeric: true },
  ];

  if (isLoading || !customer) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tone, label } = activeStatus(customer.is_active);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/customers")}>
        <ArrowLeft />
        Back to customers
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{customer.profile.name}</CardTitle>
              <StatusBadge tone={tone} label={label} />
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {customer.company ?? "No company on file"}
              {!!customer.rating && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3.5 fill-warning text-warning" />
                  {customer.rating.toFixed(1)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button
              variant={customer.is_active ? "destructive" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={deactivate.isPending || reactivate.isPending}
            >
              {customer.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="size-3.5" />
            {customer.profile.mobile}
          </div>
          {customer.profile.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-3.5" />
              {customer.profile.email}
            </div>
          )}
          {customer.profile.address && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5" />
              {customer.profile.address}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Sales" value={saleRows.length} icon={Receipt} />
        <KPICard label="Total sold" value={formatMoney(totalSold)} icon={Receipt} />
        <KPICard label="Outstanding receivable" value={formatMoney(totalReceivable)} icon={Receipt} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Sales history</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={saleColumns}
            rows={saleRows}
            rowKey={(r) => r.id}
            empty={{ icon: Receipt, title: "No sales recorded for this customer yet" }}
          />
        </CardContent>
      </Card>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
    </div>
  );
}

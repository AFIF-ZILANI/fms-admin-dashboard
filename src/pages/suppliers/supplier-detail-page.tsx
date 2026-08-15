import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Mail, MapPin, Package, Pencil, Phone, Receipt } from "lucide-react";
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
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Supplier } from "@/pages/suppliers/types";
import { SupplierFormDialog } from "@/pages/suppliers/supplier-form-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

type Purchase = {
  id: string;
  invoice_no: string | null;
  purchase_date: string;
  total_amount: string;
  paid_amount: string;
  due_amount: string;
};

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: supplier, isLoading } = useGetData<Supplier>(`/suppliers/${id}`, ["suppliers", id]);
  usePageTitle(supplier?.profile.name ?? "Supplier");

  const { data: purchases } = useGetData<Paginated<Purchase>>(`/purchases?supplier_id=${id}&limit=100`, [
    "purchases",
    "supplier",
    id,
  ]);

  const deactivate = usePostData<Supplier, void>(`/suppliers/${id}/deactivate`, ["suppliers"]);
  const reactivate = usePostData<Supplier, void>(`/suppliers/${id}/reactivate`, ["suppliers"]);

  const toggleActive = () => {
    const mutation = supplier?.is_active ? deactivate : reactivate;
    mutation.mutate(undefined, {
      onSuccess: () => toast.success(supplier?.is_active ? "Supplier deactivated" : "Supplier reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const { trueAmounts, isLoading: outstandingLoading } = useOutstanding("PURCHASE");
  const purchaseRows = purchases?.results ?? [];
  const totalPurchased = purchaseRows.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
  const totalDue = purchaseRows.reduce(
    (sum, p) => sum + parseFloat(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
    0
  );

  const purchaseColumns: Column<Purchase>[] = [
    { key: "date", header: "Date", render: (p) => new Date(p.purchase_date).toLocaleDateString() },
    { key: "invoice", header: "Invoice", render: (p) => p.invoice_no ?? "—" },
    { key: "total", header: "Total", render: (p) => formatMoney(p.total_amount), numeric: true },
    {
      key: "paid",
      header: "Paid",
      render: (p) => formatMoney(trueAmounts(p.id, p.paid_amount, p.due_amount).paid),
      numeric: true,
    },
    {
      key: "due",
      header: "Due",
      render: (p) => formatMoney(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
      numeric: true,
    },
  ];

  if (isLoading || outstandingLoading || !supplier) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tone, label } = activeStatus(supplier.is_active);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/suppliers")}>
        <ArrowLeft />
        Back to suppliers
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{supplier.profile.name}</CardTitle>
              <StatusBadge tone={tone} label={label} />
            </div>
            <p className="text-sm text-muted-foreground">
              {humanizeEnum(supplier.role)}
              {supplier.company && ` · ${supplier.company}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button
              variant={supplier.is_active ? "destructive" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={deactivate.isPending || reactivate.isPending}
            >
              {supplier.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="size-3.5" />
            {supplier.profile.mobile}
          </div>
          {supplier.profile.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-3.5" />
              {supplier.profile.email}
            </div>
          )}
          {supplier.profile.address && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5" />
              {supplier.profile.address}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {supplier.supplies.map((cat) => (
              <span key={cat} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {humanizeEnum(cat)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Purchases" value={purchaseRows.length} icon={Package} />
        <KPICard label="Total purchased" value={formatMoney(totalPurchased)} icon={Receipt} />
        <KPICard label="Outstanding due" value={formatMoney(totalDue)} icon={Receipt} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={purchaseColumns}
            rows={purchaseRows}
            rowKey={(p) => p.id}
            empty={{ icon: Receipt, title: "No purchases recorded from this supplier yet" }}
          />
        </CardContent>
      </Card>

      <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
    </div>
  );
}

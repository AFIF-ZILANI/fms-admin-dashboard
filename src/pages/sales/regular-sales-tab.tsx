import { useState } from "react";
import { useNavigate } from "react-router";
import { CreditCard, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "@/pages/inventory/types";
import { paymentStatus, type Sale } from "@/pages/sales/types";
import type { Customer } from "@/pages/customers/types";
import { SaleCreateDialog } from "@/pages/sales/sale-create-dialog";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";

export function RegularSalesTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | "ALL">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (categoryFilter !== "ALL") query.set("item_category", categoryFilter);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo + "T23:59:59.999Z");
  const { data, isLoading } = useGetData<Paginated<Sale>>(`/sales?${query}`, [
    "sales",
    categoryFilter,
    dateFrom,
    dateTo,
  ]);

  // KPI counts always reflect the unfiltered full set, not the currently-filtered view --
  // fetched separately so applying a filter doesn't make the tiles change (same pattern as Stock Ledger).
  const { data: allSales, isLoading: allSalesLoading } = useGetData<Paginated<Sale>>("/sales?limit=100", [
    "sales",
    "ALL",
    "",
    "",
  ]);

  // Sale's own `customer` relation has no name (see types.ts) — look it up separately.
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const customerName = (id: string | null) => customers?.results.find((c) => c.id === id)?.profile.name ?? "—";

  const sales = data?.results ?? [];
  const allResults = allSales?.results ?? [];
  const totalRevenue = allResults.reduce((sum, s) => sum + parseFloat(s.total), 0);
  const totalDue = allResults.reduce((sum, s) => sum + parseFloat(s.due_amount), 0);

  const columns: Column<Sale>[] = [
    { key: "date", header: "Date", render: (s) => new Date(s.sale_date).toLocaleDateString() },
    { key: "customer", header: "Customer", render: (s) => customerName(s.customer_id) },
    { key: "items", header: "Lines", render: (s) => s.items.length, numeric: true },
    { key: "total", header: "Total", render: (s) => formatMoney(s.total), numeric: true },
    { key: "due", header: "Due", render: (s) => formatMoney(s.due_amount), numeric: true },
    {
      key: "payment_status",
      header: "Payment",
      render: (s) => {
        const status = paymentStatus(s.paid_amount, s.due_amount);
        return <StatusBadge tone={status.tone} label={status.label} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Record payment"
            onClick={(e) => {
              e.stopPropagation();
              setPaymentSaleId(s.id);
            }}
          >
            <CreditCard />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard
          label="Total sales"
          value={allSales?.total ?? allResults.length}
          icon={Receipt}
          isLoading={allSalesLoading}
        />
        <KPICard label="Total revenue" value={formatMoney(totalRevenue)} icon={Wallet} isLoading={allSalesLoading} />
        <KPICard label="Outstanding due" value={formatMoney(totalDue)} icon={Wallet} isLoading={allSalesLoading} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter((v ?? "ALL") as ResourceCategory | "ALL")}
          >
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All categories")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {RESOURCE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {humanizeEnum(category)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
          />
          <Input
            type="date"
            className="w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
          />
        </div>
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
      <PaymentCreateDialog
        open={paymentSaleId !== null}
        onOpenChange={(open) => !open && setPaymentSaleId(null)}
        defaultRefType="SALE"
        defaultRefId={paymentSaleId ?? undefined}
      />
    </div>
  );
}

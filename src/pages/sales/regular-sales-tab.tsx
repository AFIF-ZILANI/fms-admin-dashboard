import { useState } from "react";
import { useNavigate } from "react-router";
import { CreditCard, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DateRangeFilter } from "@/pages/sales/date-range-filter";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import { paymentStatus, type Sale, type SalesSummary } from "@/pages/sales/types";
import type { Customer } from "@/pages/customers/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import { SaleCreateDialog } from "@/pages/sales/sale-create-dialog";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function RegularSalesTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
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
  // fetched separately so applying a filter doesn't make the tiles change (same pattern as
  // Stock Ledger). Server-side because the list endpoint caps at 100 rows and these must
  // count every sale -- summing a page of results made the revenue tile disagree with the
  // count tile beside it.
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useGetData<SalesSummary>("/sales/summary", ["sales", "summary"]);

  // Sale's own `customer` relation has no name (see types.ts) — look it up separately.
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const customerName = (id: string | null) => customers?.results.find((c) => c.id === id)?.profile.name ?? "—";
  const { data: categories } = useGetData<Paginated<LookupRow>>("/item-categories?active=true&limit=100", [
    "item-categories",
    "active",
  ]);
  const { trueAmounts } = useOutstanding("SALE");

  const sales = data?.results ?? [];

  const columns: Column<Sale>[] = [
    {
      key: "date",
      header: "Date",
      render: (s) => formatDate(s.sale_date),
      sortValue: (s) => s.sale_date,
    },
    {
      key: "customer",
      header: "Customer",
      render: (s) => customerName(s.customer_id),
      sortValue: (s) => customerName(s.customer_id),
    },
    {
      key: "items",
      header: "Lines",
      render: (s) => s.items.length,
      numeric: true,
      sortValue: (s) => s.items.length,
    },
    {
      key: "total",
      header: "Total",
      render: (s) => formatMoney(s.total),
      numeric: true,
      sortValue: (s) => parseFloat(s.total),
    },
    {
      key: "due",
      header: "Due",
      render: (s) => formatMoney(trueAmounts(s.id, s.paid_amount, s.due_amount).due),
      numeric: true,
      sortValue: (s) => parseFloat(trueAmounts(s.id, s.paid_amount, s.due_amount).due),
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (s) => {
        const amounts = trueAmounts(s.id, s.paid_amount, s.due_amount);
        const status = paymentStatus(amounts.paid, amounts.due);
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
          value={summary?.count ?? 0}
          icon={Receipt}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <KPICard
          label="Total revenue"
          value={formatMoney(summary?.total_revenue ?? 0)}
          icon={Wallet}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <KPICard
          label="Outstanding due"
          value={formatMoney(summary?.total_due ?? 0)}
          icon={Receipt}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="category_filter" className="text-xs text-muted-foreground">
              Category
            </Label>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "ALL")}>
              <SelectTrigger id="category_filter" className="w-40">
                <SelectValue>
                  {(v: string) =>
                    v && v !== "ALL"
                      ? (categories?.results.find((cat) => cat.code === v)?.label ?? humanizeEnum(v))
                      : "All categories"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {(categories?.results ?? []).map((category) => (
                  <SelectItem key={category.code} value={category.code}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
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
        footer={
          data && data.total > sales.length
            ? `Showing the ${sales.length} most recent of ${data.total} sales. Narrow the date range to see older ones.`
            : undefined
        }
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

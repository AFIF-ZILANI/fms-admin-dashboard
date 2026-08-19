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
import { paymentStatus } from "@/pages/sales/types";
import type { Purchase } from "@/pages/purchases/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import type { Supplier } from "@/pages/suppliers/types";
import { PurchaseCreateDialog } from "@/pages/purchases/purchase-create-dialog";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { ReorderSuggestionsPanel } from "@/pages/purchases/reorder-suggestions-panel";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function PurchaseHistoryTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentPurchaseId, setPaymentPurchaseId] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (supplierFilter !== "ALL") query.set("supplier_id", supplierFilter);
  if (categoryFilter !== "ALL") query.set("item_category", categoryFilter);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo + "T23:59:59.999Z");
  const { data, isLoading } = useGetData<Paginated<Purchase>>(`/purchases?${query}`, [
    "purchases",
    supplierFilter,
    categoryFilter,
    dateFrom,
    dateTo,
  ]);

  // KPI counts always reflect the unfiltered full set, not the currently-filtered view --
  // fetched separately so applying a filter doesn't make the tiles change (same pattern as Regular Sales).
  const { data: allPurchases, isLoading: allPurchasesLoading } = useGetData<Paginated<Purchase>>(
    "/purchases?limit=100",
    ["purchases", "ALL", "ALL", "", ""]
  );

  // Purchase's own `supplier` relation has no name (see types.ts) — look it up separately.
  const { data: suppliers } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const supplierName = (id: string | null) => suppliers?.results.find((s) => s.id === id)?.profile.name ?? "—";
  const { data: categories } = useGetData<Paginated<LookupRow>>("/item-categories?active=true&limit=100", [
    "item-categories",
    "active",
  ]);
  const { trueAmounts, isLoading: outstandingLoading } = useOutstanding("PURCHASE");

  const purchases = data?.results ?? [];
  const allResults = allPurchases?.results ?? [];
  const totalSpent = allResults.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
  const totalDue = allResults.reduce(
    (sum, p) => sum + parseFloat(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
    0
  );

  const columns: Column<Purchase>[] = [
    { key: "date", header: "Date", render: (p) => new Date(p.purchase_date).toLocaleDateString() },
    { key: "supplier", header: "Supplier", render: (p) => supplierName(p.supplier_id) },
    { key: "invoice", header: "Invoice", render: (p) => p.invoice_no ?? "—" },
    { key: "items", header: "Lines", render: (p) => p.items.length, numeric: true },
    { key: "total", header: "Total", render: (p) => formatMoney(p.total_amount), numeric: true },
    {
      key: "due",
      header: "Due",
      render: (p) => formatMoney(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
      numeric: true,
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (p) => {
        const amounts = trueAmounts(p.id, p.paid_amount, p.due_amount);
        const status = paymentStatus(amounts.paid, amounts.due);
        return <StatusBadge tone={status.tone} label={status.label} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Record payment"
            onClick={(e) => {
              e.stopPropagation();
              setPaymentPurchaseId(p.id);
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
      <ReorderSuggestionsPanel onRecordPurchase={() => setCreateOpen(true)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard
          label="Total purchases"
          value={allPurchases?.total ?? allResults.length}
          icon={Receipt}
          isLoading={allPurchasesLoading}
        />
        <KPICard label="Total spent" value={formatMoney(totalSpent)} icon={Wallet} isLoading={allPurchasesLoading} />
        <KPICard
          label="Outstanding due"
          value={formatMoney(totalDue)}
          icon={Wallet}
          isLoading={allPurchasesLoading || outstandingLoading}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={supplierFilter} onValueChange={(v) => setSupplierFilter(v ?? "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: string) =>
                  v && v !== "ALL"
                    ? (suppliers?.results.find((s) => s.id === v)?.profile.name ?? "Supplier")
                    : "All suppliers"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All suppliers</SelectItem>
              {(suppliers?.results ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "ALL")}>
            <SelectTrigger className="w-40">
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
      <PaymentCreateDialog
        open={paymentPurchaseId !== null}
        onOpenChange={(open) => !open && setPaymentPurchaseId(null)}
        defaultRefType="PURCHASE"
        defaultRefId={paymentPurchaseId ?? undefined}
      />
    </div>
  );
}

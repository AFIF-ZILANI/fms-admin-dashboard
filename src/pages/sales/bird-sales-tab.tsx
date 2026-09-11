import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, CreditCard, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Customer } from "@/pages/customers/types";
import type { House } from "@/pages/houses/types";
import { BirdSaleCreateDialog } from "@/pages/sales/bird-sale-create-dialog";
import {
  BIRD_GRADES,
  paymentStatus,
  type BirdGrade,
  type BirdSale,
  type BirdSalesSummary,
} from "@/pages/sales/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

const GRADE_TONE = { HIGH: "success", LOW: "warning", CULL: "critical" } as const;

export function BirdSalesTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentSaleId, setPaymentSaleId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<BirdGrade | "ALL">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (gradeFilter !== "ALL") query.set("grade", gradeFilter);
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo + "T23:59:59.999Z");
  const { data, isLoading } = useGetData<Paginated<BirdSale>>(`/bird-sales?${query}`, [
    "bird-sales",
    gradeFilter,
    dateFrom,
    dateTo,
  ]);

  // KPI counts always reflect the unfiltered full set, not the currently-filtered view --
  // fetched separately so applying a filter doesn't make the tiles change (same pattern as
  // Stock Ledger). Server-side because the list endpoint caps at 100 rows.
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useGetData<BirdSalesSummary>("/bird-sales/summary", ["bird-sales", "summary"]);

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: customers } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);
  const { trueAmounts } = useOutstanding("BIRD_SALE");

  const batchCode = (id: string) => batches?.results.find((b) => b.id === id)?.batch_code ?? "—";
  const houseName = (id: string) => houses?.results.find((h) => h.id === id)?.name ?? "—";
  const customerName = (id: string | null) => customers?.results.find((c) => c.id === id)?.profile.name ?? "—";

  const birdSales = data?.results ?? [];

  const columns: Column<BirdSale>[] = [
    { key: "date", header: "Date", render: (s) => new Date(s.sale_date).toLocaleDateString() },
    { key: "batch", header: "Batch", render: (s) => batchCode(s.batch_id) },
    { key: "house", header: "House", render: (s) => houseName(s.house_id) },
    { key: "customer", header: "Customer", render: (s) => customerName(s.customer_id) },
    { key: "grade", header: "Grade", render: (s) => <StatusBadge tone={GRADE_TONE[s.grade]} label={s.grade} /> },
    { key: "birds", header: "Birds", render: (s) => s.birds_count, numeric: true },
    { key: "net_weight", header: "Net wt (kg)", render: (s) => s.net_weight, numeric: true },
    { key: "total", header: "Total", render: (s) => formatMoney(s.total_amount), numeric: true },
    {
      key: "due",
      header: "Due",
      render: (s) => formatMoney(trueAmounts(s.id, s.paid_amount, s.due_amount).due),
      numeric: true,
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
          label="Birds sold"
          value={summary?.total_birds ?? 0}
          icon={Bird}
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

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={gradeFilter} onValueChange={(v) => setGradeFilter((v ?? "ALL") as BirdGrade | "ALL")}>
            <SelectTrigger className="w-32">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All grades")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All grades</SelectItem>
              {BIRD_GRADES.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {humanizeEnum(grade)}
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
          Record bird sale
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={birdSales}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/sales/birds/${s.id}`)}
        empty={{
          icon: Bird,
          title: "No bird sales recorded yet",
          description: "Record your first bird sale from a batch.",
          action: { label: "Record bird sale", onClick: () => setCreateOpen(true) },
        }}
      />

      <BirdSaleCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PaymentCreateDialog
        open={paymentSaleId !== null}
        onOpenChange={(open) => !open && setPaymentSaleId(null)}
        defaultRefType="BIRD_SALE"
        defaultRefId={paymentSaleId ?? undefined}
      />
    </div>
  );
}

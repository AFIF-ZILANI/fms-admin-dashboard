import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { Purchase } from "@/pages/purchases/types";
import type { Sale, BirdSale } from "@/pages/sales/types";
import type { PaymentInstrument } from "@/pages/payments/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import type { Payment } from "@/pages/payments/types";

export function PaymentsTab() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Payment>>("/payments?limit=100", ["payments"]);
  const { data: purchases } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"]);
  const { data: sales } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"]);
  const { data: birdSales } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", ["bird-sales"]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: instruments } = useGetData<Paginated<PaymentInstrument>>("/payment-instruments?limit=100", [
    "payment-instruments",
  ]);

  const instrumentLabel = (id: string | null) => instruments?.results.find((i) => i.id === id)?.label ?? "—";

  // Payment.ref_id is a polymorphic reference (see types.ts) — resolve a
  // human label per ref_type from whichever list actually has that record.
  const refLabel = (p: Payment) => {
    if (p.ref_type === "PURCHASE") {
      const purchase = purchases?.results.find((x) => x.id === p.ref_id);
      return purchase ? (purchase.invoice_no ?? "Purchase") : "Purchase";
    }
    if (p.ref_type === "SALE") {
      const sale = sales?.results.find((x) => x.id === p.ref_id);
      return sale ? `Sale · ${new Date(sale.sale_date).toLocaleDateString()}` : "Sale";
    }
    if (p.ref_type === "BIRD_SALE") {
      const birdSale = birdSales?.results.find((x) => x.id === p.ref_id);
      const batch = birdSale ? batches?.results.find((b) => b.id === birdSale.batch_id) : undefined;
      return batch?.batch_code ?? "Bird sale";
    }
    return humanizeEnum(p.ref_type);
  };

  const payments = data?.results ?? [];
  const totalIncoming = payments.filter((p) => p.direction === "INCOMING").reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalOutgoing = payments.filter((p) => p.direction === "OUTGOING").reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", render: (p) => new Date(p.payment_date).toLocaleDateString() },
    {
      key: "direction",
      header: "Direction",
      render: (p) => (
        <StatusBadge
          tone={p.direction === "INCOMING" ? "success" : "warning"}
          label={humanizeEnum(p.direction)}
        />
      ),
    },
    { key: "ref_type", header: "Pays for", render: (p) => humanizeEnum(p.ref_type) },
    { key: "ref", header: "Record", render: (p) => refLabel(p) },
    { key: "amount", header: "Amount", render: (p) => formatMoney(p.amount), numeric: true },
    { key: "from", header: "From", render: (p) => instrumentLabel(p.from_instrument_id) },
    { key: "to", header: "To", render: (p) => instrumentLabel(p.to_instrument_id) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total payments" value={data?.total ?? payments.length} icon={Receipt} isLoading={isLoading} />
        <KPICard label="Total incoming" value={formatMoney(totalIncoming)} icon={ArrowDownLeft} isLoading={isLoading} />
        <KPICard label="Total outgoing" value={formatMoney(totalOutgoing)} icon={ArrowUpRight} isLoading={isLoading} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Record payment
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={payments}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        empty={{
          icon: Wallet,
          title: "No payments recorded yet",
          description: "Record a payment against a purchase, sale, or bird sale.",
          action: { label: "Record payment", onClick: () => setCreateOpen(true) },
        }}
      />

      <PaymentCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

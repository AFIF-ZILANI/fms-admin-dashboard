import { useState } from "react";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { InstrumentBalanceCell } from "@/pages/payments/instrument-balance-cell";
import { InstrumentFormDialog } from "@/pages/payments/instrument-form-dialog";
import type { PaymentInstrument } from "@/pages/payments/types";

export function InstrumentsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentInstrument | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<PaymentInstrument>>("/payment-instruments?limit=100", [
    "payment-instruments",
  ]);
  const instruments = data?.results ?? [];

  const deactivate = usePostData<PaymentInstrument, string>(
    (id) => `/payment-instruments/${id}/deactivate`,
    ["payment-instruments"]
  );
  const reactivate = usePostData<PaymentInstrument, string>(
    (id) => `/payment-instruments/${id}/reactivate`,
    ["payment-instruments"]
  );

  const toggleActive = (instrument: PaymentInstrument) => {
    const mutation = instrument.is_active ? deactivate : reactivate;
    mutation.mutate(instrument.id, {
      onSuccess: () => toast.success(instrument.is_active ? "Instrument deactivated" : "Instrument reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (instrument: PaymentInstrument) => {
    setEditing(instrument);
    setFormOpen(true);
  };

  const columns: Column<PaymentInstrument>[] = [
    { key: "label", header: "Label", render: (i) => <span className="font-medium">{i.label}</span> },
    { key: "type", header: "Type", render: (i) => humanizeEnum(i.type) },
    { key: "owner", header: "Owner", render: (i) => humanizeEnum(i.owner_type) },
    { key: "detail", header: "Detail", render: (i) => i.bank_name ?? i.mobile_no ?? "—" },
    { key: "balance", header: "Balance", render: (i) => <InstrumentBalanceCell instrumentId={i.id} />, numeric: true },
    {
      key: "status",
      header: "Status",
      render: (i) => {
        const { tone, label } = activeStatus(i.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (i) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit instrument" onClick={() => openEdit(i)}>
            <Pencil />
          </Button>
          <Button
            variant={i.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={() => toggleActive(i)}
            disabled={(deactivate.isPending && deactivate.variables === i.id) || (reactivate.isPending && reactivate.variables === i.id)}
          >
            {i.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add instrument
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={instruments}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        empty={{
          icon: CreditCard,
          title: "No payment instruments yet",
          description: "Add a cash box, bank account, or mobile wallet.",
          action: { label: "Add instrument", onClick: openCreate },
        }}
      />

      <InstrumentFormDialog open={formOpen} onOpenChange={setFormOpen} instrument={editing} />
    </div>
  );
}

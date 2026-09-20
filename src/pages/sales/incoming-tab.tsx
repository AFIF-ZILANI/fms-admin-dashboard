import { useState } from "react";
import { Inbox } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { portionFigures, type IngestedSale } from "@/pages/sales/ingest-types";
import { ConfirmIngestedDialog } from "@/pages/sales/confirm-ingested-dialog";

/** Sales pushed from PoultryScale wait here until someone supplies the four
 * things the phone cannot know -- house, grade, customer, and a bird count when
 * the session was weighed without counting -- and confirms them into real bird
 * sales. Nothing here has touched stock or money yet. */
export function IncomingTab() {
  const [reviewing, setReviewing] = useState<IngestedSale | null>(null);

  const { data, isLoading, isError } = useGetData<IngestedSale[]>(
    "/ingest/v1/sales?status=PENDING",
    ["ingest", "PENDING"]
  );
  const rows = data ?? [];

  const columns: Column<IngestedSale>[] = [
    {
      key: "received",
      header: "Received",
      render: (r) => formatDate(r.received_at),
      sortValue: (r) => r.received_at,
    },
    {
      key: "sale_date",
      header: "Sale date",
      render: (r) => formatDate(r.device_sale_date),
      sortValue: (r) => r.device_sale_date,
    },
    {
      key: "device",
      header: "Device",
      render: (r) => r.device.label,
      sortValue: (r) => r.device.label,
    },
    {
      key: "operator",
      header: "Recorded by",
      render: (r) => r.recorded_by.name,
      sortValue: (r) => r.recorded_by.name,
    },
    {
      key: "portion",
      header: "Portion",
      render: (r) => (
        <StatusBadge
          tone={r.portion === "cull" ? "neutral" : "success"}
          label={r.portion === "cull" ? "Cull" : "Main"}
        />
      ),
    },
    { key: "buyer", header: "Buyer", render: (r) => r.payload.buyer_name || "—" },
    {
      key: "net_weight",
      header: "Net wt (kg)",
      render: (r) => portionFigures(r).netWeight,
      numeric: true,
      sortValue: (r) => portionFigures(r).netWeight,
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => formatMoney(portionFigures(r).amount),
      numeric: true,
      sortValue: (r) => portionFigures(r).amount,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        onRowClick={(r) => setReviewing(r)}
        empty={{
          icon: Inbox,
          title: isError ? "Couldn't load incoming sales" : "Nothing waiting for review",
          description: isError
            ? "Try refreshing the page."
            : "Sales pushed from PoultryScale appear here before they become bird sales.",
        }}
      />

      <ConfirmIngestedDialog
        row={reviewing}
        onOpenChange={(open) => !open && setReviewing(null)}
      />
    </div>
  );
}

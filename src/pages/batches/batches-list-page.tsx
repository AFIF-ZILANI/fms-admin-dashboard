import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, CheckCircle2, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { BATCH_STATUSES, liveBirdCount, type Batch, type BatchStatus } from "@/pages/batches/types";
import { BatchCreateDialog } from "@/pages/batches/batch-create-dialog";

const STATUS_TONE: Record<BatchStatus, Tone> = { RUNNING: "success", CLOSED: "neutral", SOLD: "neutral" };

function ageInDays(startingDate: string): number {
  return Math.floor((Date.now() - new Date(startingDate).getTime()) / (1000 * 60 * 60 * 24));
}

export function BatchesListPage() {
  usePageTitle("Batches");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const query = new URLSearchParams({ limit: "100" });
  if (statusFilter !== "ALL") query.set("status", statusFilter);
  const { data, isLoading } = useGetData<Paginated<Batch>>(`/batches?${query}`, ["batches", statusFilter]);

  const batches = data?.results ?? [];
  const totalBatches = data?.total ?? batches.length;
  const runningBatches = batches.filter((b) => b.status === "RUNNING").length;
  const closedOrSold = batches.length - runningBatches;

  const columns: Column<Batch>[] = [
    { key: "code", header: "Batch code", render: (b) => <span className="font-medium">{b.batch_code}</span> },
    { key: "breed", header: "Breed", render: (b) => humanizeEnum(b.breed) },
    { key: "phase", header: "Phase", render: (b) => humanizeEnum(b.phase) },
    { key: "days", header: "Days running", render: (b) => ageInDays(b.starting_date), numeric: true },
    { key: "live", header: "Live birds", render: (b) => liveBirdCount(b).toLocaleString(), numeric: true },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadge tone={STATUS_TONE[b.status]} label={humanizeEnum(b.status)} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total batches" value={totalBatches} icon={Bird} isLoading={isLoading} />
        <KPICard label="Running" value={runningBatches} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Closed / sold" value={closedOrSold} icon={XCircle} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BatchStatus | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: BatchStatus | "ALL" | "") => (v && v !== "ALL" ? humanizeEnum(v) : "All statuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {BATCH_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {humanizeEnum(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create batch
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={batches}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        onRowClick={(b) => navigate(`/batches/${b.id}`)}
        empty={{
          icon: Bird,
          title: "No batches yet",
          description: "Create your first batch to place chicks into a house.",
          action: { label: "Create batch", onClick: () => setCreateOpen(true) },
        }}
      />

      <BatchCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

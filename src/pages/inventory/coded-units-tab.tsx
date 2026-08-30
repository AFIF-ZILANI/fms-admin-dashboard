import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Clock, Plus, QrCode as QrCodeIcon, Search, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";
import { useGetData, usePatchData, useDelete, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { STOCK_UNIT_STATUSES, type StockUnit, type StockUnitStatus } from "@/pages/inventory/types";
import { ProvisionCodesDialog } from "@/pages/inventory/provision-codes-dialog";
import { BindCodeDialog } from "@/pages/inventory/bind-code-dialog";
import { StockUnitDetailSheet } from "@/pages/inventory/stock-unit-detail-sheet";

export function CodedUnitsTab() {
  const [statusFilter, setStatusFilter] = useState<StockUnitStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<StockUnit | null>(null);
  const [bindUnit, setBindUnit] = useState<StockUnit | null>(null);
  const [statusUnit, setStatusUnit] = useState<StockUnit | null>(null);

  // Server-side id search (the id IS the QR payload): a scanned full id must be findable even
  // when it's past the first page. ponytail: no debounce -- farm-scale usage; add one if the
  // per-keystroke fetch feels chatty.
  const q = search.trim();
  const query = new URLSearchParams({ limit: "100" });
  if (statusFilter !== "ALL") query.set("status", statusFilter);
  if (q) query.set("q", q);
  const { data, isLoading } = useGetData<Paginated<StockUnit>>(`/stock-units?${query}`, [
    "stock-units",
    statusFilter,
    q,
  ]);

  // KPI counts always reflect the unfiltered full set, not the filtered view -- fetched separately at a high limit.
  const { data: allUnits } = useGetData<Paginated<StockUnit>>("/stock-units?limit=100", [
    "stock-units",
    "ALL",
    "",
  ]);
  const counts = (allUnits?.results ?? []).reduce(
    (acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }),
    {} as Record<StockUnitStatus, number>
  );

  const units = data?.results ?? [];

  const remove = useDelete<null, string>((id) => `/stock-units/${id}`, ["stock-units"]);
  const handleDelete = (u: StockUnit) => {
    if (!confirm(`Hard-delete unit ${u.id.slice(0, 8)}? This can't be undone.`)) return;
    remove.mutate(u.id, {
      onSuccess: () => toast.success("Unit deleted"),
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<StockUnit>[] = [
    {
      key: "id",
      header: "Code",
      render: (u) => (
        <span className="font-mono text-xs" title={u.id}>
          {u.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "purchase_item",
      header: "Purchase item",
      render: (u) =>
        u.purchase_item ? (
          <Link
            to={`/purchases/${u.purchase_item.purchase_id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
            title={u.purchase_item.id}
          >
            {u.purchase_item.id.slice(0, 8)}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge tone={STOCK_UNIT_STATUS_TONE[u.status]} label={humanizeEnum(u.status)} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => setStatusUnit(u)}>
            Change status
          </Button>
          {u.status === "UNASSIGNED" && (
            <Button variant="outline" size="sm" onClick={() => setBindUnit(u)}>
              Bind
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDelete(u)}
            disabled={remove.isPending && remove.variables === u.id}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Unassigned" value={counts.UNASSIGNED ?? 0} icon={QrCodeIcon} />
        <KPICard label="In stock" value={counts.IN_STOCK ?? 0} icon={CheckCircle2} />
        <KPICard label="In use" value={counts.IN_USE ?? 0} icon={Clock} />
        <KPICard label="Disposed" value={counts.DISPOSED ?? 0} icon={XCircle} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code / scanned id…"
              className="pl-8"
              aria-label="Search coded units"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "ALL") as StockUnitStatus | "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All statuses")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STOCK_UNIT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {humanizeEnum(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBindOpen(true)}>
            Bind code
          </Button>
          <Button onClick={() => setProvisionOpen(true)}>
            <Plus />
            Provision blank codes
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={units}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        onRowClick={(u) => setSelectedUnit(u)}
        empty={
          q
            ? { icon: Search, title: "No codes match your search", description: "Try a different id fragment." }
            : {
                icon: QrCodeIcon,
                title: "No coded units yet",
                description: "Provision blank codes to start tracking medicine, vaccine, and equipment units.",
                action: { label: "Provision blank codes", onClick: () => setProvisionOpen(true) },
              }
        }
      />

      <ProvisionCodesDialog open={provisionOpen} onOpenChange={setProvisionOpen} />
      <BindCodeDialog open={bindOpen} onOpenChange={setBindOpen} />
      <BindCodeDialog
        open={!!bindUnit}
        unit={bindUnit ?? undefined}
        onOpenChange={(open) => !open && setBindUnit(null)}
      />
      <ChangeStatusDialog unit={statusUnit} onOpenChange={(open) => !open && setStatusUnit(null)} />
      <StockUnitDetailSheet unit={selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)} />
    </div>
  );
}

function ChangeStatusDialog({ unit, onOpenChange }: { unit: StockUnit | null; onOpenChange: (open: boolean) => void }) {
  const [status, setStatus] = useState<StockUnitStatus | "">("");
  const setStatusMut = usePatchData<StockUnit, { status: StockUnitStatus }>(
    () => `/stock-units/${unit?.id}/status`,
    ["stock-units"]
  );

  const handleSave = () => {
    if (!status) return;
    setStatusMut.mutate(
      { status },
      {
        onSuccess: () => {
          toast.success("Status updated");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog
      open={!!unit}
      onOpenChange={(open) => {
        if (!open) setStatus("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Set the status directly for unit <span className="font-mono text-xs">{unit?.id.slice(0, 8)}</span>.
          </DialogDescription>
        </DialogHeader>

        <Select value={status} onValueChange={(v) => setStatus((v ?? "") as StockUnitStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(v: string) => (v ? humanizeEnum(v) : `Current: ${humanizeEnum(unit?.status ?? "")}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STOCK_UNIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {humanizeEnum(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!status || setStatusMut.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

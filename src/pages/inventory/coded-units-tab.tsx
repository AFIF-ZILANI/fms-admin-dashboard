import { useState } from "react";
import { CheckCircle2, Clock, Plus, QrCode as QrCodeIcon, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { STOCK_UNIT_STATUS_TONE } from "@/components/shared/status-tone";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { STOCK_UNIT_STATUSES, type StockUnit, type StockUnitStatus } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import { ProvisionCodesDialog } from "@/pages/inventory/provision-codes-dialog";
import { BindCodeDialog } from "@/pages/inventory/bind-code-dialog";
import { StockUnitDetailSheet } from "@/pages/inventory/stock-unit-detail-sheet";

// Only medicine/vaccine/equipment get per-unit QR codes (docs/PRD.md §6.4 Notes) -- filter offers just those.
// ponytail: these are live ItemCategory.code values a user can rename via
// Settings, which silently breaks this filter dropdown with no error --
// needs a stable-key mechanism (e.g. an is_system flag) if renaming these
// specific categories becomes a real risk.
const CODED_CATEGORIES = ["MEDICINE", "VACCINE", "EQUIPMENT"] as const;

export function CodedUnitsTab() {
  const [statusFilter, setStatusFilter] = useState<StockUnitStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<(typeof CODED_CATEGORIES)[number] | "ALL">("ALL");
  const [houseFilter, setHouseFilter] = useState<string>("ALL");
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<StockUnit | null>(null);

  const query = new URLSearchParams({ limit: "100" });
  if (statusFilter !== "ALL") query.set("status", statusFilter);
  if (categoryFilter !== "ALL") query.set("category", categoryFilter);
  if (houseFilter !== "ALL") query.set("house_id", houseFilter);
  const { data, isLoading } = useGetData<Paginated<StockUnit>>(`/stock-units?${query}`, [
    "stock-units",
    statusFilter,
    categoryFilter,
    houseFilter,
  ]);

  // KPI counts always reflect the unfiltered full set, not the filtered view -- fetched separately at a high limit.
  const { data: allUnits } = useGetData<Paginated<StockUnit>>("/stock-units?limit=100", [
    "stock-units",
    "ALL",
    "ALL",
    "ALL",
  ]);
  const counts = (allUnits?.results ?? []).reduce(
    (acc, u) => ({ ...acc, [u.status]: (acc[u.status] ?? 0) + 1 }),
    {} as Record<StockUnitStatus, number>
  );

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);

  const units = data?.results ?? [];

  const columns: Column<StockUnit>[] = [
    { key: "code", header: "Code", render: (u) => <span className="font-mono text-xs">{u.code}</span> },
    { key: "item", header: "Item", render: (u) => u.purchase_item?.item.name ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusBadge tone={STOCK_UNIT_STATUS_TONE[u.status]} label={humanizeEnum(u.status)} />,
    },
    { key: "house", header: "House", render: (u) => u.house?.name ?? "—" },
    {
      key: "remaining",
      header: "Remaining qty",
      render: (u) => u.remaining_quantity ?? "—",
      numeric: true,
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

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setBindOpen(true)}>
          Bind code
        </Button>
        <Button onClick={() => setProvisionOpen(true)}>
          <Plus />
          Provision blank codes
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "ALL") as StockUnitStatus | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All statuses")}
            </SelectValue>
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
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter((v ?? "ALL") as (typeof CODED_CATEGORIES)[number] | "ALL")}
        >
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All categories")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {CODED_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {humanizeEnum(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={houseFilter} onValueChange={(v) => setHouseFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? houses?.results.find((h) => h.id === v)?.name ?? "House" : "All houses")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All houses</SelectItem>
            {(houses?.results ?? []).map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={units}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        onRowClick={(u) => setSelectedUnit(u)}
        empty={{
          icon: QrCodeIcon,
          title: "No coded units yet",
          description: "Provision blank codes to start tracking medicine, vaccine, and equipment units.",
          action: { label: "Provision blank codes", onClick: () => setProvisionOpen(true) },
        }}
      />

      <ProvisionCodesDialog open={provisionOpen} onOpenChange={setProvisionOpen} />
      <BindCodeDialog open={bindOpen} onOpenChange={setBindOpen} />
      <StockUnitDetailSheet unit={selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)} />
    </div>
  );
}

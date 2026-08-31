import { useState } from "react";
import { ArrowRightLeft, PackagePlus, Plus, Route, Undo2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ALLOCATION_TYPE_TONE } from "@/components/shared/status-tone";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { ALLOCATION_TYPES, type AllocationType, type StockHouseAllocationEntry } from "@/pages/inventory/types";
import type { House } from "@/pages/houses/types";
import { StockAllocationFormDialog } from "@/pages/inventory/stock-allocation-form-dialog";

export function StockAllocationTab() {
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [houseFilter, setHouseFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<AllocationType | "ALL">("ALL");

  const query = new URLSearchParams({ limit: "100" });
  if (houseFilter !== "ALL") query.set("house_id", houseFilter);
  if (typeFilter !== "ALL") query.set("type", typeFilter);
  const { data, isLoading } = useGetData<Paginated<StockHouseAllocationEntry>>(
    `/stock-house-allocations?${query}`,
    ["stock-house-allocations", houseFilter, typeFilter]
  );

  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);

  // KPI counts always reflect the unfiltered full set, same pattern as Stock Ledger / Coded Units.
  const { data: allEntries, isLoading: allEntriesLoading } = useGetData<Paginated<StockHouseAllocationEntry>>(
    "/stock-house-allocations?limit=100",
    ["stock-house-allocations", "ALL", "ALL"]
  );
  const allResults = allEntries?.results ?? [];
  const totalEvents = allEntries?.total ?? allResults.length;
  const allocationCount = allResults.filter((e) => e.type === "ALLOCATION").length;
  const reallocationCount = allResults.filter((e) => e.type === "REALLOCATION").length;
  const returnCount = allResults.filter((e) => e.type === "RETURN").length;

  const columns: Column<StockHouseAllocationEntry>[] = [
    {
      key: "date",
      header: "Date",
      render: (e) => new Date(e.occurred_at).toLocaleDateString(),
      sortValue: (e) => new Date(e.occurred_at).getTime(),
    },
    {
      key: "unit",
      header: "Unit",
      render: (e) => (
        <span className="font-mono text-xs" title={e.stock_unit_id}>
          {e.stock_unit_id.slice(0, 8)}
        </span>
      ),
    },
    { key: "item", header: "Item", render: (e) => e.stock_unit.purchase_item?.item.name ?? "—" },
    {
      key: "type",
      header: "Type",
      render: (e) => <StatusBadge tone={ALLOCATION_TYPE_TONE[e.type]} label={humanizeEnum(e.type)} />,
    },
    { key: "house", header: "House", render: (e) => e.house?.name ?? "Warehouse" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total events" value={totalEvents} icon={Route} isLoading={allEntriesLoading} />
        <KPICard label="Allocations" value={allocationCount} icon={PackagePlus} isLoading={allEntriesLoading} />
        <KPICard label="Reallocations" value={reallocationCount} icon={ArrowRightLeft} isLoading={allEntriesLoading} />
        <KPICard label="Returns" value={returnCount} icon={Undo2} isLoading={allEntriesLoading} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={houseFilter} onValueChange={(v) => setHouseFilter(v ?? "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: string) => (v && v !== "ALL" ? houses?.results.find((h) => h.id === v)?.name ?? "House" : "All houses")}
              </SelectValue>
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
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v ?? "ALL") as AllocationType | "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All types")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {ALLOCATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {humanizeEnum(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setAllocateOpen(true)}>
          <Plus />
          Allocate stock
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: Route,
          title: "No stock allocations yet",
          description: "Every allocate/reallocate/return move for a coded unit will show up here.",
        }}
      />

      <StockAllocationFormDialog open={allocateOpen} onOpenChange={setAllocateOpen} />
    </div>
  );
}

import { useState } from "react";
import { CalendarDays, Coins, ListTree, Tags, Wheat } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { daysAgoMs, formatMoney, humanizeEnum } from "@/lib/utils";
import type { ConsumptionByCategoryRow } from "@/pages/analytics/types";
import type { Consumption, Item } from "@/pages/inventory/types";
import type { Batch } from "@/pages/batches/types";
import type { House } from "@/pages/houses/types";

export function ConsumptionLogTab() {
  const [batchFilter, setBatchFilter] = useState<string>("ALL");
  const [houseFilter, setHouseFilter] = useState<string>("ALL");
  const [itemFilter, setItemFilter] = useState<string>("ALL");
  const [occurredFrom, setOccurredFrom] = useState("");
  const [occurredTo, setOccurredTo] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (batchFilter !== "ALL") query.set("batch_id", batchFilter);
  if (houseFilter !== "ALL") query.set("house_id", houseFilter);
  if (itemFilter !== "ALL") query.set("item_id", itemFilter);
  if (occurredFrom) query.set("occurred_from", occurredFrom);
  if (occurredTo) query.set("occurred_to", occurredTo);
  const { data, isLoading } = useGetData<Paginated<Consumption>>(`/consumptions?${query}`, [
    "consumptions",
    batchFilter,
    houseFilter,
    itemFilter,
    occurredFrom,
    occurredTo,
  ]);

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: houses } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);
  const { data: items } = useGetData<Paginated<Item>>("/items?limit=100", ["items"]);

  // KPIs ignore the table filters: lifetime total plus a fixed 30-day window. Draw counts come
  // from the API total (exact), the money from the costed category rollup.
  const monthStart = new Date(daysAgoMs(30)).toISOString().slice(0, 10);
  const { data: allConsumptions, isLoading: allLoading } = useGetData<Paginated<Consumption>>(
    "/consumptions?limit=1",
    ["consumptions", "kpi", "all"]
  );
  const { data: monthConsumptions, isLoading: monthLoading } = useGetData<Paginated<Consumption>>(
    `/consumptions?limit=1&occurred_from=${monthStart}`,
    ["consumptions", "kpi", monthStart]
  );
  const { data: byCategory, isLoading: categoryLoading, isError: categoryError } = useGetData<ConsumptionByCategoryRow[]>(
    "/analytics/inventory/consumption-by-category?days=30",
    ["analytics", "inventory-kpi", "consumed", 30]
  );
  const monthValue = (byCategory ?? []).reduce((sum, r) => sum + Number(r.total), 0);
  const topCategory = byCategory?.[0];

  const columns: Column<Consumption>[] = [
    {
      key: "date",
      header: "Date",
      render: (c) => new Date(c.date).toLocaleDateString(),
      sortValue: (c) => new Date(c.date).getTime(),
    },
    { key: "item", header: "Item", render: (c) => c.item.name, sortValue: (c) => c.item.name },
    { key: "quantity", header: "Quantity", render: (c) => c.quantity, numeric: true },
    { key: "house", header: "House", render: (c) => c.house.name },
    { key: "batch", header: "Batch", render: (c) => c.batch?.batch_code ?? "—" },
    {
      key: "coded_unit",
      header: "Coded unit",
      render: (c) => (c.stock_unit ? <span className="font-mono text-xs">{c.stock_unit.id.slice(0, 8)}</span> : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total draws" value={allConsumptions?.total ?? 0} hint="all time" icon={ListTree} isLoading={allLoading} />
        <KPICard label="Draws (30 days)" value={monthConsumptions?.total ?? 0} icon={CalendarDays} isLoading={monthLoading} />
        <KPICard label="Value consumed" value={formatMoney(monthValue)} hint="last 30 days, at avg purchase cost" icon={Coins} isLoading={categoryLoading} isError={categoryError} />
        <KPICard label="Avg per day" value={formatMoney(monthValue / 30)} hint="consumption value" icon={Wheat} isLoading={categoryLoading} isError={categoryError} />
        <KPICard label="Top category" value={topCategory ? humanizeEnum(topCategory.category) : "—"} hint={topCategory ? formatMoney(topCategory.total) + ", last 30 days" : "no consumption yet"} icon={Tags} isLoading={categoryLoading} isError={categoryError} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={batchFilter} onValueChange={(v) => setBatchFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) =>
                v && v !== "ALL" ? batches?.results.find((b) => b.id === v)?.batch_code ?? "Batch" : "All batches"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All batches</SelectItem>
            {(batches?.results ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.batch_code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Select value={itemFilter} onValueChange={(v) => setItemFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {(v: string) => (v && v !== "ALL" ? items?.results.find((i) => i.id === v)?.name ?? "Item" : "All items")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All items</SelectItem>
            {(items?.results ?? []).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-40"
          value={occurredFrom}
          onChange={(e) => setOccurredFrom(e.target.value)}
          aria-label="From date"
        />
        <Input
          type="date"
          className="w-40"
          value={occurredTo}
          onChange={(e) => setOccurredTo(e.target.value)}
          aria-label="To date"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        totalCount={data?.total}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        empty={{
          icon: ListTree,
          title: "No consumption recorded yet",
          description: "Feed, medicine, and equipment draws will show up here regardless of where they were recorded.",
        }}
      />
    </div>
  );
}

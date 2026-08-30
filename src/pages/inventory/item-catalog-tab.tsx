import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, CheckCircle2, Package, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Item, ItemStockByLocation, LowStockItem } from "@/pages/inventory/types";
import { StockBreakdownSheet } from "@/pages/inventory/stock-breakdown-sheet";
import type { LookupRow } from "@/pages/settings/lookup-types";

/** Sum on-hand balances for display. ponytail: JS floats are fine for a shown stock total at
 * farm scale; round to 3dp to shed accumulation noise. Individual balances stay exact strings. */
function sumBalances(rows: ItemStockByLocation[]) {
  return rows.reduce((total, r) => total + Number(r.balance), 0);
}
function formatQty(n: number) {
  return String(Number(n.toFixed(3)));
}

export function ItemCatalogTab({ onViewLowStock }: { onViewLowStock: () => void }) {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const query = new URLSearchParams({ limit: "100" });
  if (categoryFilter !== "ALL") query.set("category", categoryFilter);
  const { data, isLoading } = useGetData<Paginated<Item>>(`/items?${query}`, ["items", categoryFilter]);

  // No search endpoint on GET /api/items (docs/api.md §6.1) — but the page already
  // fetches up to limit=100 (effectively "everything" for a realistic catalog size),
  // so filtering that in memory is instant and needs no debounce or network round-trip.
  const allItems = data?.results ?? [];
  const q = search.trim().toLowerCase();
  const items = q
    ? allItems.filter((i) => i.name.toLowerCase().includes(q) || humanizeEnum(i.category).toLowerCase().includes(q))
    : allItems;

  const totalItems = data?.total ?? allItems.length;
  const activeCount = allItems.filter((i) => i.is_active).length;
  const { data: lowStockItems, isLoading: lowStockLoading } = useGetData<LowStockItem[]>(
    "/items/low-stock",
    ["items", "low-stock"]
  );
  const lowStockCount = lowStockItems?.length ?? 0;

  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/item-categories?active=true&limit=100",
    ["item-categories", "active"]
  );

  const deactivate = usePostData<Item, string>((id) => `/items/${id}/deactivate`, ["items"]);
  const reactivate = usePostData<Item, string>((id) => `/items/${id}/reactivate`, ["items"]);

  // One fetch feeds both stock columns and both breakdown sheets (see GET /items/stock-by-location).
  const { data: stockRows } = useGetData<ItemStockByLocation[]>(
    "/items/stock-by-location",
    ["items", "stock-by-location"]
  );
  const stockByItem = useMemo(() => {
    const map = new Map<string, { WAREHOUSE: ItemStockByLocation[]; HOUSE: ItemStockByLocation[] }>();
    for (const row of stockRows ?? []) {
      const entry = map.get(row.item_id) ?? { WAREHOUSE: [], HOUSE: [] };
      entry[row.location_type].push(row);
      map.set(row.item_id, entry);
    }
    return map;
  }, [stockRows]);

  const [breakdown, setBreakdown] = useState<{
    itemId: string;
    itemName: string;
    unit: string;
    kind: "WAREHOUSE" | "HOUSE";
  } | null>(null);
  const breakdownRows = breakdown ? (stockByItem.get(breakdown.itemId)?.[breakdown.kind] ?? []) : [];

  const toggleActive = (item: Item) => {
    const mutation = item.is_active ? deactivate : reactivate;
    mutation.mutate(item.id, {
      onSuccess: () => toast.success(item.is_active ? "Item deactivated" : "Item reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const openCreate = () => navigate("/inventory/items/new");
  const openEdit = (item: Item) => navigate(`/inventory/items/${item.id}/edit`);

  // Clickable total for a stock column: opens the per-location breakdown sheet, or "—" when empty.
  const stockCell = (item: Item, kind: "WAREHOUSE" | "HOUSE") => {
    const total = sumBalances(stockByItem.get(item.id)?.[kind] ?? []);
    if (total <= 0) return <span className="text-muted-foreground">—</span>;
    return (
      <button
        type="button"
        onClick={() => setBreakdown({ itemId: item.id, itemName: item.name, unit: item.unit, kind })}
        className="tabular-nums text-primary underline-offset-2 hover:underline"
      >
        {formatQty(total)}
      </button>
    );
  };

  const columns: Column<Item>[] = [
    { key: "name", header: "Name", render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", render: (i) => humanizeEnum(i.category) },
    { key: "unit", header: "Unit", render: (i) => humanizeEnum(i.unit) },
    {
      key: "warehouse_stock",
      header: "Warehouse stock",
      render: (i) => stockCell(i, "WAREHOUSE"),
      numeric: true,
      sortValue: (i) => sumBalances(stockByItem.get(i.id)?.WAREHOUSE ?? []),
    },
    {
      key: "house_stock",
      header: "Stock in houses",
      render: (i) => stockCell(i, "HOUSE"),
      numeric: true,
      sortValue: (i) => sumBalances(stockByItem.get(i.id)?.HOUSE ?? []),
    },
    { key: "reorder_level", header: "Reorder level", render: (i) => i.reorder_level ?? "—", numeric: true },
    { key: "lead_time", header: "Lead time", render: (i) => (i.lead_time_days != null ? `${i.lead_time_days}d` : "—"), numeric: true },
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
          <Button variant="ghost" size="icon-sm" aria-label="Edit item" onClick={() => openEdit(i)}>
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total items" value={totalItems} icon={Package} isLoading={isLoading} />
        <KPICard label="Active" value={activeCount} icon={CheckCircle2} isLoading={isLoading} />
        <button type="button" onClick={onViewLowStock} className="text-left">
          <KPICard label="Below reorder level" value={lowStockCount} icon={AlertTriangle} isLoading={lowStockLoading} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name or category…"
              className="pl-8"
              aria-label="Search items"
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

          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "ALL")}>
            <SelectTrigger className="w-48">
              <SelectValue>
                {(value: string) =>
                  value && value !== "ALL"
                    ? (categories?.results.find((cat) => cat.code === value)?.label ?? humanizeEnum(value))
                    : "All categories"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {(categories?.results ?? []).map((cat) => (
                <SelectItem key={cat.code} value={cat.code}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreate}>
          <Plus />
          Add item
        </Button>
      </div>

      {search && (
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "match" : "matches"} for "{search}"
        </p>
      )}

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        empty={
          search
            ? { icon: Search, title: "No items match your search", description: "Try a different name or category." }
            : {
                icon: Package,
                title: "No items yet",
                description: "Add your first catalog item.",
                action: { label: "Add item", onClick: openCreate },
              }
        }
      />

      <StockBreakdownSheet
        target={breakdown}
        rows={breakdownRows}
        onOpenChange={(open) => !open && setBreakdown(null)}
      />
    </div>
  );
}

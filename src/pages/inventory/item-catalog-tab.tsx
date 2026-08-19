import { useState } from "react";
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
import type { Item, LowStockItem } from "@/pages/inventory/types";
import type { LookupRow } from "@/pages/settings/lookup-types";
import { ItemFormDialog } from "@/pages/inventory/item-form-dialog";

export function ItemCatalogTab({ onViewLowStock }: { onViewLowStock: () => void }) {
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>(undefined);

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

  const toggleActive = (item: Item) => {
    const mutation = item.is_active ? deactivate : reactivate;
    mutation.mutate(item.id, {
      onSuccess: () => toast.success(item.is_active ? "Item deactivated" : "Item reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const openCreate = () => {
    setEditingItem(undefined);
    setFormOpen(true);
  };
  const openEdit = (item: Item) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const columns: Column<Item>[] = [
    { key: "name", header: "Name", render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", render: (i) => humanizeEnum(i.category) },
    { key: "unit", header: "Unit", render: (i) => humanizeEnum(i.unit) },
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

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editingItem} />
    </div>
  );
}

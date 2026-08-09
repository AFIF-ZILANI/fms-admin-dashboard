import { useState } from "react";
import { Package, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { RESOURCE_CATEGORIES, type Item, type ResourceCategory } from "@/pages/inventory/types";
import { ItemFormDialog } from "@/pages/inventory/item-form-dialog";

export function ItemCatalogTab() {
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | undefined>(undefined);

  const query = new URLSearchParams({ limit: "100" });
  if (categoryFilter !== "ALL") query.set("category", categoryFilter);
  const { data, isLoading } = useGetData<Paginated<Item>>(`/items?${query}`, ["items", categoryFilter]);

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
      <div className="flex items-center justify-between">
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ResourceCategory | "ALL")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {RESOURCE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {humanizeEnum(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={openCreate}>
          <Plus />
          Add item
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        empty={{
          icon: Package,
          title: "No items yet",
          description: "Add your first catalog item.",
          action: { label: "Add item", onClick: openCreate },
        }}
      />

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editingItem} />
    </div>
  );
}

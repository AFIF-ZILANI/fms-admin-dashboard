import { useState } from "react";
import { Pencil, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { toast } from "sonner";
import { useGetData, useDelete, type Paginated } from "@/lib/api";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Warehouse } from "@/pages/inventory/types";
import { WarehouseFormDialog } from "@/pages/inventory/warehouse-form-dialog";

export function WarehousesTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<Warehouse>>("/warehouses?limit=100", ["warehouses"]);
  const totalWarehouses = data?.total ?? data?.results.length ?? 0;

  const openCreate = () => {
    setEditingWarehouse(undefined);
    setFormOpen(true);
  };
  const openEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormOpen(true);
  };

  // A warehouse has no is_active, so delete is the only way to clear a typo. The server
  // refuses (409) the moment any purchase, adjustment or stock movement names it.
  const remove = useDelete<null, string>((id) => `/warehouses/${id}`, ["warehouses"]);
  const { confirm, confirmDialog } = useConfirm();

  const deleteWarehouse = async (warehouse: Warehouse) => {
    const ok = await confirm({
      title: `Delete ${warehouse.name}?`,
      description:
        "This permanently removes the warehouse. It only works if nothing was ever stored, purchased or moved here -- otherwise rename it instead.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(warehouse.id, {
      onSuccess: () => toast.success("Warehouse deleted"),
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<Warehouse>[] = [
    { key: "name", header: "Name", render: (w) => <span className="font-medium">{w.name}</span> },
    { key: "created", header: "Added", render: (w) => new Date(w.created_at).toLocaleDateString() },
    {
      key: "actions",
      header: "",
      render: (w) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Rename warehouse" onClick={() => openEdit(w)}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete warehouse"
            onClick={() => void deleteWarehouse(w)}
            disabled={remove.isPending && remove.variables === w.id}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total warehouses" value={totalWarehouses} icon={WarehouseIcon} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add warehouse
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        empty={{
          icon: WarehouseIcon,
          title: "No warehouses yet",
          description: "Add your first storage location.",
          action: { label: "Add warehouse", onClick: openCreate },
        }}
      />

      <WarehouseFormDialog open={formOpen} onOpenChange={setFormOpen} warehouse={editingWarehouse} />

      {confirmDialog}
    </div>
  );
}

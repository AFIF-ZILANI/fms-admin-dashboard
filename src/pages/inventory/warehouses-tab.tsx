import { useState } from "react";
import { Pencil, Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
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

  const columns: Column<Warehouse>[] = [
    { key: "name", header: "Name", render: (w) => <span className="font-medium">{w.name}</span> },
    { key: "created", header: "Added", render: (w) => new Date(w.created_at).toLocaleDateString() },
    {
      key: "actions",
      header: "",
      render: (w) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" aria-label="Rename warehouse" onClick={() => openEdit(w)}>
            <Pencil />
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
    </div>
  );
}

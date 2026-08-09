import { useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import type { Organization } from "@/pages/inventory/types";
import { OrganizationFormDialog } from "@/pages/inventory/organization-form-dialog";

export function OrganizationsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<Organization>>("/organizations?limit=100", ["organizations"]);

  const openCreate = () => {
    setEditingOrganization(undefined);
    setFormOpen(true);
  };
  const openEdit = (organization: Organization) => {
    setEditingOrganization(organization);
    setFormOpen(true);
  };

  const columns: Column<Organization>[] = [
    { key: "name", header: "Name", render: (o) => <span className="font-medium">{o.label_name}</span> },
    { key: "created", header: "Added", render: (o) => new Date(o.created_at).toLocaleDateString() },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" aria-label="Edit organization" onClick={() => openEdit(o)}>
            <Pencil />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add organization
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(o) => o.id}
        isLoading={isLoading}
        empty={{
          icon: Building2,
          title: "No organizations yet",
          description: "Add a manufacturer, importer, marketer, or distributor for recall tracing.",
          action: { label: "Add organization", onClick: openCreate },
        }}
      />

      <OrganizationFormDialog open={formOpen} onOpenChange={setFormOpen} organization={editingOrganization} />
    </div>
  );
}

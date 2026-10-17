import { useState } from "react";
import { Building2, Factory, Link2Off, Package, Plane, Store, Truck, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import type { Organization } from "@/pages/inventory/types";
import { OrganizationFormDialog } from "@/pages/inventory/organization-form-dialog";

export function OrganizationsTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrganization, setEditingOrganization] = useState<Organization | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<Organization>>("/organizations?limit=100", ["organizations"]);
  const orgs = data?.results ?? [];
  const totalOrganizations = data?.total ?? orgs.length;
  const withRole = (role: string) => orgs.filter((o) => (o.itemLinks ?? []).some((l) => l.role === role)).length;
  const unlinked = orgs.filter((o) => (o.itemLinks ?? []).length === 0).length;
  const itemsCovered = new Set(orgs.flatMap((o) => (o.itemLinks ?? []).map((l) => l.item.id))).size;

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Organizations" value={totalOrganizations} icon={Building2} isLoading={isLoading} />
        <KPICard label="Manufacturers" value={withRole("MANUFACTURER")} hint="make at least one item" icon={Factory} isLoading={isLoading} />
        <KPICard label="Importers" value={withRole("IMPORTER")} hint="import at least one item" icon={Plane} isLoading={isLoading} />
        <KPICard label="Distributors" value={withRole("DISTRIBUTOR")} hint="distribute at least one item" icon={Truck} isLoading={isLoading} />
        <KPICard label="Marketers" value={withRole("MARKETER")} hint="market at least one item" icon={Store} isLoading={isLoading} />
        <KPICard label="Items covered" value={itemsCovered} hint="linked to an organization" icon={Package} isLoading={isLoading} />
        <KPICard label="No linked items" value={unlinked} hint="not tied to any item" tone={unlinked > 0 ? "warning" : undefined} icon={Link2Off} isLoading={isLoading} />
      </div>

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

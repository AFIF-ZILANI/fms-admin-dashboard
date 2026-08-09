import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Plus, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { SUPPLIER_ROLES, type Supplier, type SupplierRole } from "@/pages/suppliers/types";
import { SupplierFormDialog } from "@/pages/suppliers/supplier-form-dialog";

export function SuppliersListPage() {
  usePageTitle("Suppliers");
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<SupplierRole | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);

  // limit=100 (the API max) rather than paging — small enough supplier counts in
  // practice that this doubles as "fetch everything" for both the table and the stats below.
  const query = new URLSearchParams({ limit: "100" });
  if (roleFilter !== "ALL") query.set("role", roleFilter);
  const { data, isLoading } = useGetData<Paginated<Supplier>>(`/suppliers?${query}`, ["suppliers", roleFilter]);

  const suppliers = data?.results ?? [];
  const totalSuppliers = data?.total ?? suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.is_active).length;
  const inactiveSuppliers = suppliers.length - activeSuppliers;

  const columns: Column<Supplier>[] = [
    { key: "name", header: "Name", render: (s) => <span className="font-medium">{s.profile.name}</span> },
    { key: "company", header: "Company", render: (s) => s.company ?? "—" },
    { key: "role", header: "Role", render: (s) => humanizeEnum(s.role) },
    { key: "mobile", header: "Mobile", render: (s) => s.profile.mobile },
    {
      key: "supplies",
      header: "Supplies",
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.supplies.slice(0, 2).map((cat) => (
            <span key={cat} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {humanizeEnum(cat)}
            </span>
          ))}
          {s.supplies.length > 2 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              +{s.supplies.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => {
        const { tone, label } = activeStatus(s.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total suppliers" value={totalSuppliers} icon={Truck} isLoading={isLoading} />
        <KPICard label="Active" value={activeSuppliers} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Inactive" value={inactiveSuppliers} icon={XCircle} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-between">
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as SupplierRole | "ALL")}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {(value: SupplierRole | "ALL" | "") => (value && value !== "ALL" ? humanizeEnum(value) : "All roles")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {SUPPLIER_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {humanizeEnum(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add supplier
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        empty={{
          icon: Truck,
          title: "No suppliers yet",
          description: "Add your first supplier to start recording purchases.",
          action: { label: "Add supplier", onClick: () => setFormOpen(true) },
        }}
      />

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

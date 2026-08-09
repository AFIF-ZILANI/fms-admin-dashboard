import { useState } from "react";
import { CheckCircle2, Pencil, Plus, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { Admin } from "@/pages/admins/types";
import { AdminFormDialog } from "@/pages/admins/admin-form-dialog";

// ponytail: row actions instead of a detail page — an Admin has no data
// beyond profile info to show, and Audit Log (where "view action history"
// would link) doesn't exist yet. Add a detail page if that changes.
export function AdminsListPage() {
  usePageTitle("Admins");
  const [formOpen, setFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<Admin>>("/admins?limit=100", ["admins"]);

  const deactivate = usePostData<Admin, string>((id) => `/admins/${id}/deactivate`, ["admins"]);
  const reactivate = usePostData<Admin, string>((id) => `/admins/${id}/reactivate`, ["admins"]);

  const toggleActive = (admin: Admin) => {
    const mutation = admin.profile.is_active ? deactivate : reactivate;
    mutation.mutate(admin.id, {
      onSuccess: () => toast.success(admin.profile.is_active ? "Admin deactivated" : "Admin reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const openCreate = () => {
    setEditingAdmin(undefined);
    setFormOpen(true);
  };
  const openEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormOpen(true);
  };

  const admins = data?.results ?? [];
  const totalAdmins = data?.total ?? admins.length;
  const activeAdmins = admins.filter((a) => a.profile.is_active).length;
  const inactiveAdmins = admins.length - activeAdmins;

  const columns: Column<Admin>[] = [
    { key: "name", header: "Name", render: (a) => <span className="font-medium">{a.profile.name}</span> },
    { key: "mobile", header: "Mobile", render: (a) => a.profile.mobile },
    { key: "email", header: "Email", render: (a) => a.profile.email ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (a) => {
        const { tone, label } = activeStatus(a.profile.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Edit admin" onClick={() => openEdit(a)}>
            <Pencil />
          </Button>
          <Button
            variant={a.profile.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={() => toggleActive(a)}
            disabled={
              (deactivate.isPending && deactivate.variables === a.id) ||
              (reactivate.isPending && reactivate.variables === a.id)
            }
          >
            {a.profile.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total admins" value={totalAdmins} icon={ShieldCheck} isLoading={isLoading} />
        <KPICard label="Active" value={activeAdmins} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Inactive" value={inactiveAdmins} icon={XCircle} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Add admin
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={admins}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        empty={{
          icon: ShieldCheck,
          title: "No admins yet",
          description: "Add your first admin account.",
          action: { label: "Add admin", onClick: openCreate },
        }}
      />

      <AdminFormDialog open={formOpen} onOpenChange={setFormOpen} admin={editingAdmin} />
    </div>
  );
}

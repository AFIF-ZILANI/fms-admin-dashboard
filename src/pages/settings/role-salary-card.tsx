import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/utils/NumaricInput";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, usePatchData, useDelete, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { FIXED_WAGE_RATIO, type EmployeeRoleConfig } from "@/pages/employees/types";

export function RoleSalaryCard() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<EmployeeRoleConfig | undefined>(undefined);
  const [label, setLabel] = useState("");
  const [salary, setSalary] = useState("");
  const { confirm, confirmDialog } = useConfirm();

  const { data, isLoading } = useGetData<Paginated<EmployeeRoleConfig>>(
    "/employee-roles?limit=100",
    ["employee-roles"]
  );
  const rows = data?.results ?? [];

  const create = usePostData<EmployeeRoleConfig, { label: string; reference_salary: number }>(
    "/employee-roles",
    ["employee-roles"]
  );
  const update = usePatchData<
    EmployeeRoleConfig,
    { id: string; label: string; reference_salary: number }
  >((vars) => `/employee-roles/${vars.id}`, ["employee-roles"]);
  const deactivate = usePostData<EmployeeRoleConfig, string>(
    (id) => `/employee-roles/${id}/deactivate`,
    ["employee-roles"]
  );
  const reactivate = usePostData<EmployeeRoleConfig, string>(
    (id) => `/employee-roles/${id}/reactivate`,
    ["employee-roles"]
  );
  const remove = useDelete<null, string>((id) => `/employee-roles/${id}`, ["employee-roles"]);

  const openCreate = () => {
    setEditingRole(undefined);
    setLabel("");
    setSalary("");
    setFormOpen(true);
  };
  const openEdit = (row: EmployeeRoleConfig) => {
    setEditingRole(row);
    setLabel(row.label);
    setSalary(row.reference_salary);
    setFormOpen(true);
  };

  const onSubmit = () => {
    const vars = { label, reference_salary: Number(salary) };
    if (editingRole) {
      update.mutate(
        { id: editingRole.id, ...vars },
        {
          onSuccess: () => {
            toast.success("Role updated");
            setFormOpen(false);
          },
          onError: (error) => toast.error(error.message),
        }
      );
    } else {
      create.mutate(vars, {
        onSuccess: () => {
          toast.success("Role added");
          setFormOpen(false);
        },
        onError: (error) => toast.error(error.message),
      });
    }
  };

  const toggleActive = (row: EmployeeRoleConfig) => {
    const mutation = row.is_active ? deactivate : reactivate;
    mutation.mutate(row.id, {
      onSuccess: () => toast.success(row.is_active ? "Deactivated" : "Reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const onDelete = async (row: EmployeeRoleConfig) => {
    const ok = await confirm({
      title: "Delete role?",
      description: `Delete "${row.label}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(row.id, {
      onSuccess: () => toast.success("Role deleted"),
      // The 409 "still in use" message is already worded well server-side --
      // shown as-is rather than restated here.
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<EmployeeRoleConfig>[] = [
    { key: "label", header: "Role", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "code", header: "Code", render: (r) => <span className="text-xs text-muted-foreground">{r.code}</span> },
    {
      key: "reference_salary",
      header: "Reference salary",
      render: (r) => formatMoney(r.reference_salary),
      numeric: true,
    },
    {
      key: "fixed_wage",
      header: "Fixed wage",
      render: (r) => (
        <span className="text-muted-foreground">
          {formatMoney(Number(r.reference_salary) * FIXED_WAGE_RATIO)}
        </span>
      ),
      numeric: true,
    },
    { key: "employee_count", header: "Employees", render: (r) => r.employee_count, numeric: true },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const { tone, label: statusLabel } = activeStatus(r.is_active);
        return <StatusBadge tone={tone} label={statusLabel} />;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.label}`} onClick={() => openEdit(r)}>
            <Pencil />
          </Button>
          <Button
            variant={r.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={() => toggleActive(r)}
            disabled={
              (deactivate.isPending && deactivate.variables === r.id) ||
              (reactivate.isPending && reactivate.variables === r.id)
            }
          >
            {r.is_active ? "Deactivate" : "Reactivate"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${r.label}`}
            onClick={() => void onDelete(r)}
            disabled={r.employee_count > 0 || (remove.isPending && remove.variables === r.id)}
            title={r.employee_count > 0 ? "In use — deactivate it instead" : undefined}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Roles &amp; Salaries
        </CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus />
          Add role
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This is the standard salary offered to a new hire in the role. Changing it here never
          moves an existing employee's pay — that only happens if their own record is edited.
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          empty={{ icon: Users, title: "No roles yet", description: "Add your first one." }}
        />
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit role" : "Add role"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-label">Role name</Label>
              <Input id="role-label" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
              {editingRole && (
                <p className="text-xs text-muted-foreground">
                  Code stays {editingRole.code} — employees who hold this role keep it.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-salary">Reference salary</Label>
              <NumericInput
                id="role-salary"
                allowDecimal
                decimalPlaces={2}
                placeholder="15000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={!label.trim() || !Number(salary) || create.isPending || update.isPending}
            >
              {editingRole ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Card>
  );
}

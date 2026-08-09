import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Plus, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { EmployeeFormDialog } from "@/pages/employees/employee-form-dialog";
import type { Employee } from "@/pages/employees/types";

export function EmployeesListPage() {
  usePageTitle("Employees");
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);

  const deactivate = usePostData<Employee, string>((id) => `/employees/${id}/deactivate`, ["employees"]);
  const reactivate = usePostData<Employee, string>((id) => `/employees/${id}/reactivate`, ["employees"]);

  const toggleActive = (employee: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    const mutation = employee.profile.is_active ? deactivate : reactivate;
    mutation.mutate(employee.id, {
      onSuccess: () => toast.success(employee.profile.is_active ? "Employee deactivated" : "Employee reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const employees = data?.results ?? [];
  const totalEmployees = data?.total ?? employees.length;
  const activeEmployees = employees.filter((e) => e.profile.is_active).length;
  const inactiveEmployees = employees.length - activeEmployees;

  const columns: Column<Employee>[] = [
    { key: "name", header: "Name", render: (e) => <span className="font-medium">{e.profile.name}</span> },
    { key: "role", header: "Role", render: (e) => humanizeEnum(e.role) },
    { key: "salary", header: "Salary", render: (e) => formatMoney(e.salary), numeric: true },
    { key: "rating", header: "Rating", render: (e) => (e.rating ? `★ ${e.rating.toFixed(1)}` : "—"), numeric: true },
    { key: "joining_date", header: "Joined", render: (e) => new Date(e.joining_date).toLocaleDateString() },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const { tone, label } = activeStatus(e.profile.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (e) => (
        <div className="flex justify-end gap-1">
          <Button
            variant={e.profile.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={(ev) => toggleActive(e, ev)}
            disabled={
              (deactivate.isPending && deactivate.variables === e.id) ||
              (reactivate.isPending && reactivate.variables === e.id)
            }
          >
            {e.profile.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total employees" value={totalEmployees} icon={Users} isLoading={isLoading} />
        <KPICard label="Active" value={activeEmployees} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Inactive" value={inactiveEmployees} icon={XCircle} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add employee
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={employees}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        onRowClick={(e) => navigate(`/employees/${e.id}`)}
        empty={{
          icon: Users,
          title: "No employees yet",
          description: "Add your first employee.",
          action: { label: "Add employee", onClick: () => setFormOpen(true) },
        }}
      />

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

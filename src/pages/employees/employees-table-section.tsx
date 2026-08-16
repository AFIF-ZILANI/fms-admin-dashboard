import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { EmployeeFormDialog } from "@/pages/employees/employee-form-dialog";
import { EMPLOYEE_ROLES, type Employee, type EmployeeRole } from "@/pages/employees/types";

export function EmployeesTableSection() {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

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

  const allEmployees = data?.results ?? [];

  // No search endpoint for employees -- the page already fetches limit=100
  // (same convention as ItemCatalogTab), so filtering in memory is instant.
  const q = search.trim().toLowerCase();
  const employees = allEmployees
    .filter((e) => roleFilter === "ALL" || e.role === roleFilter)
    .filter((e) => statusFilter === "ALL" || (statusFilter === "ACTIVE") === e.profile.is_active)
    .filter((e) => !q || e.profile.name.toLowerCase().includes(q));

  const isFiltered = !!q || roleFilter !== "ALL" || statusFilter !== "ALL";

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="pl-8"
              aria-label="Search employees"
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

          <Select value={roleFilter} onValueChange={(v) => setRoleFilter((v ?? "ALL") as EmployeeRole | "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: EmployeeRole | "ALL" | "") => (v && v !== "ALL" ? humanizeEnum(v) : "All roles")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {EMPLOYEE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {humanizeEnum(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "ALL") as typeof statusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {(v: string) => (v === "ACTIVE" ? "Active" : v === "INACTIVE" ? "Inactive" : "All statuses")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add employee
        </Button>
      </div>

      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          {employees.length} {employees.length === 1 ? "match" : "matches"}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={employees}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        onRowClick={(e) => navigate(`/employees/${e.id}`)}
        empty={
          isFiltered
            ? { icon: Search, title: "No employees match your filters", description: "Try a different search or filter." }
            : {
                icon: Users,
                title: "No employees yet",
                description: "Add your first employee.",
                action: { label: "Add employee", onClick: () => setFormOpen(true) },
              }
        }
      />

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

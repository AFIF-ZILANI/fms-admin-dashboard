import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus, EMPLOYMENT_STATUS_TONE } from "@/components/shared/status-tone";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  type Employee,
  type EmployeeRole,
} from "@/pages/employees/types";

export function EmployeesTableSection() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const { data, isLoading } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);

  const allEmployees = data?.results ?? [];

  // No search endpoint for employees -- the page already fetches limit=100
  // (same convention as ItemCatalogTab), so filtering in memory is instant.
  const q = search.trim().toLowerCase();
  const employees = allEmployees
    .filter((e) => roleFilter === "ALL" || e.role === roleFilter)
    .filter((e) => statusFilter === "ALL" || (statusFilter === "ACTIVE") === e.profile.is_active)
    .filter((e) => !q || e.profile.name.toLowerCase().includes(q) || e.profile.mobile.includes(q));

  const isFiltered = !!q || roleFilter !== "ALL" || statusFilter !== "ALL";

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      render: (e) => (
        <div className="flex items-center gap-2.5">
          {e.profile.avatar ? (
            <img
              src={e.profile.avatar.image_url}
              alt=""
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {e.profile.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{e.profile.name}</p>
            <p className="truncate text-xs text-muted-foreground">{e.profile.mobile}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (e) => EMPLOYEE_ROLE_LABELS[e.role] },
    { key: "salary", header: "Reference salary", render: (e) => formatMoney(e.reference_salary), numeric: true },
    { key: "rating", header: "Rating", render: (e) => (e.rating ? `★ ${e.rating.toFixed(1)}` : "—"), numeric: true },
    { key: "joining_date", header: "Joined", render: (e) => new Date(e.joining_date).toLocaleDateString() },
    {
      key: "employment_status",
      header: "Stage",
      render: (e) => (
        <StatusBadge
          tone={EMPLOYMENT_STATUS_TONE[e.employment_status]}
          label={EMPLOYMENT_STATUS_LABELS[e.employment_status]}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const { tone, label } = activeStatus(e.profile.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
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
              placeholder="Search name or mobile…"
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
                {(v: EmployeeRole | "ALL" | "") => (v && v !== "ALL" ? EMPLOYEE_ROLE_LABELS[v] : "All roles")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {EMPLOYEE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {EMPLOYEE_ROLE_LABELS[role]}
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

        <Button onClick={() => navigate("/employees/new")}>
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
                action: { label: "Add employee", onClick: () => navigate("/employees/new") },
              }
        }
      />
    </div>
  );
}

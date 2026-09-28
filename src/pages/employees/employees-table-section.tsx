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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const q = search.trim();

  // Filters narrow the whole set server-side, so a stale page could land out of
  // range. Reset during render rather than in an effect — React's own "adjust
  // state when a prop changes" pattern, and it avoids the cascading re-render
  // an effect-driven setState causes here.
  const filterKey = `${roleFilter}:${statusFilter}:${q}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  // ponytail: no debounce on the search box -- farm scale; add one if the roster
  // ever grows enough for the keystroke-per-request to matter.
  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (roleFilter !== "ALL") query.set("role", roleFilter);
  if (statusFilter !== "ALL") query.set("is_active", String(statusFilter === "ACTIVE"));
  if (q) query.set("q", q);

  const { data, isLoading } = useGetData<Paginated<Employee>>(`/employees?${query}`, [
    "employees",
    page,
    roleFilter,
    statusFilter,
    q,
  ]);

  const employees = data?.results ?? [];
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

      {isFiltered && data && (
        <p className="text-xs text-muted-foreground">
          {data.total} {data.total === 1 ? "match" : "matches"}
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

      {/* Shown even on a single page: hiding it leaves no way to tell whether the
          table is paginated at all, and the count is worth having regardless. */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total}{" "}
            {data.total === 1 ? "employee" : "employees"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

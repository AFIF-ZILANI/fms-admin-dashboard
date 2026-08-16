import { CheckCircle2, Users, XCircle } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import type { Employee } from "@/pages/employees/types";
import { EmployeesAnalytics } from "@/pages/employees/employees-analytics";
import { EmployeesTableSection } from "@/pages/employees/employees-table-section";

export function EmployeesListPage() {
  usePageTitle("Employees");

  const { data, isLoading } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const employees = data?.results ?? [];
  const totalEmployees = data?.total ?? employees.length;
  const activeEmployees = employees.filter((e) => e.profile.is_active).length;
  const inactiveEmployees = employees.length - activeEmployees;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total employees" value={totalEmployees} icon={Users} isLoading={isLoading} />
        <KPICard label="Active" value={activeEmployees} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Inactive" value={inactiveEmployees} icon={XCircle} isLoading={isLoading} />
      </div>

      <EmployeesAnalytics />

      <EmployeesTableSection />
    </div>
  );
}

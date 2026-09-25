import { Banknote, CheckCircle2, Users } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Employee } from "@/pages/employees/types";
import { EmployeesAnalytics } from "@/pages/employees/employees-analytics";
import { EmployeesTableSection } from "@/pages/employees/employees-table-section";

export function EmployeesListPage() {
  usePageTitle("Employees");

  const { data, isLoading } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const employees = data?.results ?? [];
  const totalEmployees = data?.total ?? employees.length;
  const active = employees.filter((e) => e.profile.is_active);

  // Baseline monthly wage bill of everyone currently on staff. Payroll runs can
  // adjust it by -10%/+20%, so this is the floor, not the settled figure.
  const monthlyWageBill = active.reduce((sum, e) => sum + Number(e.salary), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total employees" value={totalEmployees} icon={Users} isLoading={isLoading} />
        <KPICard label="Active" value={active.length} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard
          label="Monthly wage bill"
          value={formatMoney(monthlyWageBill)}
          icon={Banknote}
          isLoading={isLoading}
        />
      </div>

      <EmployeesAnalytics />

      <EmployeesTableSection />
    </div>
  );
}

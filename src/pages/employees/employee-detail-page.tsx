import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Award, Banknote, Pencil, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { EmployeeFormDialog } from "@/pages/employees/employee-form-dialog";
import { ScoreEntryDialog } from "@/pages/employees/score-entry-dialog";
import { PayrollRunDialog } from "@/pages/employees/payroll-run-dialog";
import type { Employee, PayrollRecord, PerformanceScoreEntry } from "@/pages/employees/types";

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);

  const { data: employee, isLoading } = useGetData<Employee>(`/employees/${id}`, ["employees", id]);
  usePageTitle(employee?.profile.name ?? "Employee");

  const { data: scoreEntries } = useGetData<Paginated<PerformanceScoreEntry>>(
    `/performance-score-entries?employee_id=${id}&limit=100`,
    ["performance-score-entries", id]
  );
  const { data: payrollRecords } = useGetData<Paginated<PayrollRecord>>(
    `/payroll-records?employee_id=${id}&limit=100`,
    ["payroll-records", id]
  );

  const entries = scoreEntries?.results ?? [];
  const records = payrollRecords?.results ?? [];

  const now = new Date();
  const mtdSum = entries
    .filter((e) => {
      const d = new Date(e.date);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    })
    .reduce((sum, e) => sum + e.points, 0);

  const scoreColumns: Column<PerformanceScoreEntry>[] = [
    { key: "date", header: "Date", render: (e) => new Date(e.date).toLocaleDateString() },
    { key: "criterion", header: "Criterion", render: (e) => humanizeEnum(e.criterion) },
    {
      key: "points",
      header: "Points",
      render: (e) => (
        <span className={e.points >= 0 ? "text-success" : "text-critical"}>
          {e.points > 0 ? "+" : ""}
          {e.points}
        </span>
      ),
      numeric: true,
    },
    { key: "reason", header: "Reason", render: (e) => e.reason },
  ];

  const payrollColumns: Column<PayrollRecord>[] = [
    {
      key: "month",
      header: "Month",
      render: (p) => new Date(p.month).toLocaleDateString(undefined, { year: "numeric", month: "long" }),
    },
    { key: "baseline", header: "Baseline", render: (p) => formatMoney(p.baseline_salary), numeric: true },
    { key: "score_sum", header: "Score sum", render: (p) => p.score_sum, numeric: true },
    { key: "adjustment", header: "Adjustment", render: (p) => `${parseFloat(p.adjustment_percent) > 0 ? "+" : ""}${p.adjustment_percent}%`, numeric: true },
    { key: "final", header: "Final salary", render: (p) => formatMoney(p.final_salary), numeric: true },
  ];

  if (isLoading || !employee) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tone, label } = activeStatus(employee.profile.is_active);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/employees")}>
        <ArrowLeft />
        Back to employees
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{employee.profile.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {humanizeEnum(employee.role)} · {employee.profile.mobile}
              {employee.profile.email ? ` · ${employee.profile.email}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={tone} label={label} />
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Current salary" value={formatMoney(employee.salary)} icon={Wallet} />
        <KPICard label="MTD score sum" value={mtdSum > 0 ? `+${mtdSum}` : mtdSum} icon={Award} />
        <KPICard label="Rating" value={employee.rating ? `★ ${employee.rating.toFixed(1)}` : "—"} icon={Award} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Performance history</CardTitle>
          <Button size="sm" onClick={() => setScoreOpen(true)}>
            <Plus />
            Add score entry
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={scoreColumns}
            rows={entries}
            rowKey={(e) => e.id}
            empty={{ icon: Award, title: "No score entries yet" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payroll history</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setPayrollOpen(true)}>
            <Banknote />
            Run payroll
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={payrollColumns}
            rows={records}
            rowKey={(p) => p.id}
            empty={{ icon: Banknote, title: "No payroll runs yet" }}
          />
        </CardContent>
      </Card>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} />
      {id && <ScoreEntryDialog open={scoreOpen} onOpenChange={setScoreOpen} employeeId={id} />}
      {id && (
        <PayrollRunDialog
          open={payrollOpen}
          onOpenChange={setPayrollOpen}
          employeeId={id}
          baselineSalary={employee.salary}
          scoreEntries={entries}
        />
      )}
    </div>
  );
}

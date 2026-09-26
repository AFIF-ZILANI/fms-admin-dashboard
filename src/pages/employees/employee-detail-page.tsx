import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Award, Banknote, CreditCard, Pencil, Plus, UserMinus, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus, EMPLOYMENT_STATUS_TONE } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { toast } from "sonner";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { EmployeeActivityTimeline } from "@/pages/employees/employee-activity-timeline";
import { ScoreEntryDialog } from "@/pages/employees/score-entry-dialog";
import { PayrollRunDialog } from "@/pages/employees/payroll-run-dialog";
import { EmployeeProfileCard } from "@/pages/employees/employee-profile-card";
import {
  EMPLOYEE_ROLE_LABELS,
  EMPLOYMENT_STATUS_LABELS,
  type Employee,
  type PayrollRecord,
  type PerformanceScoreEntry,
} from "@/pages/employees/types";
import { PaymentCreateDialog } from "@/pages/payments/payment-create-dialog";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [paymentPayrollId, setPaymentPayrollId] = useState<string | null>(null);

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
  const { trueAmounts } = useOutstanding("PAYROLL");
  const { confirm, confirmDialog } = useConfirm();

  const terminate = usePostData<Employee, string>((eid) => `/employees/${eid}/terminate`, [
    "employees",
  ]);

  const reinstate = usePostData<Employee, string>((eid) => `/employees/${eid}/reinstate`, [
    "employees",
  ]);

  const onTerminate = async (name: string) => {
    const ok = await confirm({
      title: `Terminate ${name}?`,
      description:
        "Their employment ends and the profile goes inactive. Their performance and payroll history stays on record.",
      confirmLabel: "Terminate",
      destructive: true,
    });
    if (!ok || !id) return;
    terminate.mutate(id, {
      onSuccess: () => toast.success(`${name} terminated`),
      onError: (error) => toast.error(error.message),
    });
  };

  const onReinstate = async (name: string) => {
    const ok = await confirm({
      title: `Reinstate ${name}?`,
      description:
        "They come back as active staff at the Appointed stage, so the appointment and probation paperwork starts over.",
      confirmLabel: "Reinstate",
    });
    if (!ok || !id) return;
    reinstate.mutate(id, {
      onSuccess: () => toast.success(`${name} reinstated`),
      onError: (error) => toast.error(error.message),
    });
  };

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
    { key: "due", header: "Due", render: (p) => formatMoney(trueAmounts(p.id, "0", p.final_salary).due), numeric: true },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" aria-label="Record payment" onClick={() => setPaymentPayrollId(p.id)}>
            <CreditCard />
          </Button>
        </div>
      ),
      className: "text-right",
    },
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {employee.profile.avatar ? (
              <img
                src={employee.profile.avatar.image_url}
                alt={employee.profile.name}
                className="size-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-medium text-muted-foreground">
                {employee.profile.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <CardTitle className="text-xl">{employee.profile.name}</CardTitle>
              <p className="truncate text-sm text-muted-foreground">
                {EMPLOYEE_ROLE_LABELS[employee.role]} · {employee.profile.mobile}
                {employee.profile.email ? ` · ${employee.profile.email}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge
              tone={EMPLOYMENT_STATUS_TONE[employee.employment_status]}
              label={EMPLOYMENT_STATUS_LABELS[employee.employment_status]}
            />
            <StatusBadge tone={tone} label={label} />
            <Button variant="outline" size="sm" onClick={() => navigate(`/employees/${employee.id}/edit`)}>
              <Pencil />
              Edit
            </Button>
            {employee.employment_status === "TERMINATED" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={reinstate.isPending}
                onClick={() => void onReinstate(employee.profile.name)}
              >
                <UserPlus />
                Reinstate
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                disabled={terminate.isPending}
                onClick={() => void onTerminate(employee.profile.name)}
              >
                <UserMinus />
                Terminate
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Current salary" value={formatMoney(employee.salary)} icon={Wallet} />
        <KPICard label="MTD score sum" value={mtdSum > 0 ? `+${mtdSum}` : mtdSum} icon={Award} />
        <KPICard label="Rating" value={employee.rating ? `★ ${employee.rating.toFixed(1)}` : "—"} icon={Award} />
      </div>

      <EmployeeProfileCard employee={employee} />

      <EmployeeActivityTimeline scoreEntries={entries} payrollRecords={records} />

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
      {confirmDialog}

      <PaymentCreateDialog
        open={paymentPayrollId !== null}
        onOpenChange={(open) => !open && setPaymentPayrollId(null)}
        defaultRefType="PAYROLL"
        defaultRefId={paymentPayrollId ?? undefined}
      />
    </div>
  );
}

import { useState } from "react";
import { AlarmClock, CheckCircle2, ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { daysAgoMs, humanizeEnum } from "@/lib/utils";
import type { Employee } from "@/pages/employees/types";
import { AssignTaskDialog } from "@/pages/tasks/assign-task-dialog";
import { formatDateTime, isOverdue, type TaskAssignment } from "@/pages/tasks/types";

type StatusFilter = "PENDING" | "OVERDUE" | "DONE" | "CANCELLED" | "ALL";
const STATUS_FILTERS: StatusFilter[] = ["PENDING", "OVERDUE", "DONE", "CANCELLED", "ALL"];
const ALL_EMPLOYEES = "ALL";

function statusOf(a: TaskAssignment): { tone: Tone; label: string } {
  if (isOverdue(a)) return { tone: "critical", label: "Overdue" };
  if (a.status === "PENDING") return { tone: "warning", label: "Pending" };
  if (a.status === "DONE") return { tone: "success", label: "Done" };
  return { tone: "neutral", label: "Cancelled" };
}

const place = (a: TaskAssignment) => a.house?.name ?? a.location_note ?? "—";

export function AssignmentsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [employeeFilter, setEmployeeFilter] = useState(ALL_EMPLOYEES);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<TaskAssignment | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const query = new URLSearchParams({ limit: "100" });
  // Overdue is pending-and-late, worked out here: the API filters by stored status only.
  if (statusFilter !== "ALL") query.set("status", statusFilter === "OVERDUE" ? "PENDING" : statusFilter);
  if (employeeFilter !== ALL_EMPLOYEES) query.set("employee_id", employeeFilter);
  const { data, isLoading } = useGetData<Paginated<TaskAssignment>>(`/task-assignments?${query}`, [
    "task-assignments",
    statusFilter,
    employeeFilter,
  ]);
  const rows = (data?.results ?? []).filter((a) => statusFilter !== "OVERDUE" || isOverdue(a));
  // Newest due first for finished work; soonest first (the API order) for what's still open.
  const ordered =
    statusFilter === "DONE" || statusFilter === "CANCELLED" || statusFilter === "ALL" ? [...rows].reverse() : rows;

  const { data: pending, isLoading: pendingLoading } = useGetData<Paginated<TaskAssignment>>(
    "/task-assignments?status=PENDING&limit=100",
    ["task-assignments", "kpi-pending"]
  );
  const weekAgo = new Date(daysAgoMs(7)).toISOString();
  const { data: doneWeek, isLoading: doneLoading } = useGetData<Paginated<TaskAssignment>>(
    `/task-assignments?status=DONE&due_from=${encodeURIComponent(weekAgo)}&limit=1`,
    ["task-assignments", "kpi-done-week"]
  );
  const overdueCount = (pending?.results ?? []).filter((a) => isOverdue(a)).length;

  const { data: employeesData } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees", "assignable"]);
  const employees = employeesData?.results ?? [];

  const cancel = usePostData<TaskAssignment, string>((id) => `/task-assignments/${id}/cancel`, ["task-assignments"]);

  const cancelSelected = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Cancel this task?",
      description: `"${selected.title}" will drop off ${selected.employee.profile.name}'s list.`,
      confirmLabel: "Cancel task",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(selected.id, {
      onSuccess: () => {
        toast.success("Task cancelled");
        setSelected(null);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<TaskAssignment>[] = [
    {
      key: "title",
      header: "Task",
      render: (a) => (
        <div className="flex flex-col">
          <span className="font-medium">{a.title}</span>
          {a.title !== a.task.label && <span className="text-xs text-muted-foreground">{a.task.label}</span>}
        </div>
      ),
      sortValue: (a) => a.title,
    },
    {
      key: "employee",
      header: "Assigned to",
      render: (a) => a.employee.profile.name,
      sortValue: (a) => a.employee.profile.name,
    },
    { key: "place", header: "Where", render: place },
    {
      key: "due",
      header: "Due",
      render: (a) => formatDateTime(a.due_at),
      sortValue: (a) => new Date(a.due_at).getTime(),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => {
        const { tone, label } = statusOf(a);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Open tasks" value={pending?.total ?? 0} icon={ClipboardList} isLoading={pendingLoading} />
        <KPICard label="Overdue" value={overdueCount} icon={AlarmClock} isLoading={pendingLoading} />
        <KPICard label="Done this week" value={doneWeek?.total ?? 0} icon={CheckCircle2} isLoading={doneLoading} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "PENDING") as StatusFilter)}>
              <SelectTrigger id="task-status-filter" className="w-36">
                <SelectValue>{(v: string) => humanizeEnum(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-employee-filter">Employee</Label>
            <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? ALL_EMPLOYEES)}>
              <SelectTrigger id="task-employee-filter" className="w-48">
                <SelectValue>
                  {(v: string) => employees.find((e) => e.id === v)?.profile.name ?? "Everyone"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_EMPLOYEES}>Everyone</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => setAssignOpen(true)}>
          <Plus />
          Assign task
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={ordered}
        totalCount={data?.total}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        onRowClick={setSelected}
        empty={{
          icon: ClipboardList,
          title: statusFilter === "PENDING" ? "Nothing open" : "No tasks here",
          description: "Tasks assigned here or by a manager in the field app show up in this list.",
          action: { label: "Assign task", onClick: () => setAssignOpen(true) },
        }}
      />

      <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>
                {selected.task.label}
                {selected.task.task_type ? ` · opens the ${selected.task.task_type.label} form` : " · mark-done task"}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge {...statusOf(selected)} />
              </dd>
              <dt className="text-muted-foreground">Assigned to</dt>
              <dd>{selected.employee.profile.name}</dd>
              <dt className="text-muted-foreground">Where</dt>
              <dd>{place(selected)}</dd>
              <dt className="text-muted-foreground">Due</dt>
              <dd>{formatDateTime(selected.due_at)}</dd>
              {selected.description && (
                <>
                  <dt className="text-muted-foreground">Instructions</dt>
                  <dd>{selected.description}</dd>
                </>
              )}
              {selected.completed_at && (
                <>
                  <dt className="text-muted-foreground">Done</dt>
                  <dd>{formatDateTime(selected.completed_at)}</dd>
                </>
              )}
              {selected.completion_note && (
                <>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd>{selected.completion_note}</dd>
                </>
              )}
            </dl>
            <DialogFooter>
              {selected.status === "PENDING" && (
                <Button variant="destructive" disabled={cancel.isPending} onClick={cancelSelected}>
                  Cancel task
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      {confirmDialog}
    </div>
  );
}

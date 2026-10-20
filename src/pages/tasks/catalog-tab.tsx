import { useState } from "react";
import { ClipboardList, ListChecks, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { LookupManagerCard } from "@/pages/settings/lookup-manager-card";
import type { Task, TaskType } from "@/pages/tasks/types";

const PLAIN = "__plain__";

type TaskPayload = { label: string; task_type_id: string | null };

function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>
            A task managers and admins can assign, e.g. "Morning environment reading".
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every open starts from the task's current values. */}
        {open && <TaskForm task={task} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const [label, setLabel] = useState(task?.label ?? "");
  const [typeId, setTypeId] = useState(task?.task_type_id ?? PLAIN);
  const [error, setError] = useState<string | undefined>();

  const { data: typesData } = useGetData<Paginated<TaskType>>("/task-types?limit=100", ["task-types"]);
  // Read optional fields into locals before any closure: the React Compiler memoizes `task?.x` inside a
  // callback as `task.x`, which throws when adding a new task (task undefined).
  const taskId = task?.id;
  const currentTypeId = task?.task_type_id;
  const isActive = task?.is_active ?? true;
  const types = (typesData?.results ?? []).filter((t) => t.is_active || t.id === currentTypeId);

  const create = usePostData<Task, TaskPayload>("/tasks", ["tasks"]);
  const update = usePatchData<Task, TaskPayload>(`/tasks/${taskId}`, ["tasks"]);
  const setActive = usePostData<Task, boolean>(
    (active) => `/tasks/${taskId}/${active ? "reactivate" : "deactivate"}`,
    ["tasks"]
  );
  const mutation = task ? update : create;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setError("Label is required");
    mutation.mutate(
      { label: label.trim(), task_type_id: typeId === PLAIN ? null : typeId },
      {
        onSuccess: () => {
          toast.success(task ? "Task updated" : "Task added");
          onClose();
        },
        onError: (err) => {
          const message = err.fieldError("label");
          if (message) setError(message);
          else toast.error(err.message);
        },
      }
    );
  };

  const toggleActive = () => {
    const next = !isActive;
    setActive.mutate(next, {
      onSuccess: () => {
        toast.success(next ? "Task reactivated" : "Task deactivated");
        onClose();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-label">Label</Label>
        <Input id="task-label" value={label} onChange={(e) => setLabel(e.target.value)} aria-invalid={!!error} />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-type">What the field app opens</Label>
        <Select value={typeId} onValueChange={(v) => setTypeId(v ?? PLAIN)}>
          <SelectTrigger id="task-type" className="w-full">
            <SelectValue>{(v: string) => types.find((t) => t.id === v)?.label ?? "Just a mark-done check"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PLAIN}>Just a mark-done check</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label} form
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter className="sm:justify-between">
        {task ? (
          <Button
            type="button"
            variant={isActive ? "destructive" : "outline"}
            disabled={setActive.isPending}
            onClick={toggleActive}
          >
            {isActive ? "Deactivate" : "Reactivate"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {task ? "Save changes" : "Add task"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function CatalogTab() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const { data, isLoading } = useGetData<Paginated<Task>>("/tasks?limit=100", ["tasks"]);
  const tasks = data?.results ?? [];

  const open = (task?: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const columns: Column<Task>[] = [
    {
      key: "label",
      header: "Task",
      render: (t) => <span className="font-medium">{t.label}</span>,
      sortValue: (t) => t.label,
    },
    {
      key: "type",
      header: "Opens",
      render: (t) => (t.task_type ? `${t.task_type.label} form` : "Mark-done check"),
      sortValue: (t) => t.task_type?.label ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (t) => {
        const { tone, label } = activeStatus(t.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            The tasks that can be assigned. Deactivating one keeps its history.
          </p>
          <Button onClick={() => open()}>
            <Plus />
            Add task
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={tasks}
          totalCount={data?.total}
          rowKey={(t) => t.id}
          isLoading={isLoading}
          onRowClick={open}
          empty={{
            icon: ClipboardList,
            title: "No tasks yet",
            description: "Add the jobs your team does, then assign them.",
            action: { label: "Add task", onClick: () => open() },
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Task types decide which form the field app opens. The app has forms for mortality, consumption, weight,
          environment, medication and vaccination; a type it doesn't know opens as a mark-done check.
        </p>
        <LookupManagerCard
          title="Task types"
          singular="Task type"
          endpoint="/task-types"
          queryKey="task-types"
          icon={ListChecks}
        />
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} />
    </div>
  );
}

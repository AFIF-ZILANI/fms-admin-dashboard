import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Employee } from "@/pages/employees/types";
import type { House } from "@/pages/houses/types";
import type { Task, TaskAssignment } from "@/pages/tasks/types";

type Payload = {
  employee_id: string;
  task_id: string;
  title: string;
  description?: string;
  house_id?: string;
  location_note?: string;
  due_at: string;
};

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
const toLocalInput = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const NO_HOUSE = "__none__";

export function AssignTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
          <DialogDescription>It shows up on the employee's Tasks tab in the field app.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every open starts from a blank form. */}
        {open && <AssignTaskForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AssignTaskForm({ onClose }: { onClose: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [houseId, setHouseId] = useState(NO_HOUSE);
  const [locationNote, setLocationNote] = useState("");
  const [dueAt, setDueAt] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3_600_000)));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: employeesData } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees", "assignable"]);
  const { data: tasksData } = useGetData<Paginated<Task>>("/tasks?limit=100&active=true", ["tasks", "active"]);
  const { data: housesData } = useGetData<Paginated<House>>("/houses?limit=100", ["houses"]);

  const employees = (employeesData?.results ?? []).filter(
    (e) => e.employment_status !== "TERMINATED" && e.profile.is_active
  );
  const tasks = tasksData?.results ?? [];
  const houses = (housesData?.results ?? []).filter((h) => h.is_active);

  const assign = usePostData<TaskAssignment, Payload>("/task-assignments", ["task-assignments"]);

  const pickTask = (id: string) => {
    // Prefill the title from the task, unless the admin already wrote their own.
    const previous = tasks.find((t) => t.id === taskId)?.label ?? "";
    if (!title || title === previous) setTitle(tasks.find((t) => t.id === id)?.label ?? "");
    setTaskId(id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!employeeId) next.employee_id = "Pick who does it";
    if (!taskId) next.task_id = "Pick a task";
    if (!title.trim()) next.title = "Title is required";
    if (!dueAt) next.due_at = "Pick a due time";
    else if (new Date(dueAt).getTime() < Date.now()) next.due_at = "Due time is in the past";
    setErrors(next);
    if (Object.keys(next).length) return;

    assign.mutate(
      {
        employee_id: employeeId,
        task_id: taskId,
        title: title.trim(),
        description: description.trim() || undefined,
        // A house or a free-text place, never both (the server refuses both).
        ...(houseId !== NO_HOUSE
          ? { house_id: houseId }
          : locationNote.trim()
            ? { location_note: locationNote.trim() }
            : {}),
        due_at: new Date(dueAt).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success("Task assigned");
          onClose();
        },
        onError: (error) => {
          if (error.fields) setErrors(error.fields);
          else toast.error(error.message);
        },
      }
    );
  };

  const err = (key: string) => errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>;

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-employee">Assign to</Label>
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
            <SelectTrigger id="assign-employee" className="w-full" aria-invalid={!!errors.employee_id}>
              <SelectValue>
                {(v: string) => employees.find((e) => e.id === v)?.profile.name ?? "Select an employee"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.profile.name} · {humanizeEnum(e.role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err("employee_id")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-task">Task</Label>
          <Select value={taskId} onValueChange={(v) => pickTask(v ?? "")}>
            <SelectTrigger id="assign-task" className="w-full" aria-invalid={!!errors.task_id}>
              <SelectValue>{(v: string) => tasks.find((t) => t.id === v)?.label ?? "Select a task"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tasks.length === 0 && (
            <p className="text-xs text-muted-foreground">No active tasks. Add one under Task catalog.</p>
          )}
          {err("task_id")}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-title">Title</Label>
        <Input
          id="assign-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!errors.title}
        />
        {err("title")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-description">Instructions (optional)</Label>
        <Input id="assign-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-house">House (optional)</Label>
          <Select value={houseId} onValueChange={(v) => setHouseId(v ?? NO_HOUSE)}>
            <SelectTrigger id="assign-house" className="w-full">
              <SelectValue>{(v: string) => houses.find((h) => h.id === v)?.name ?? "Not a house"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HOUSE}>Not a house</SelectItem>
              {houses.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assign-location">Other place (optional)</Label>
          <Input
            id="assign-location"
            placeholder="e.g. front gate"
            value={locationNote}
            disabled={houseId !== NO_HOUSE}
            onChange={(e) => setLocationNote(e.target.value)}
            aria-invalid={!!errors.location_note}
          />
          {err("location_note")}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assign-due">Due</Label>
        <Input
          id="assign-due"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          aria-invalid={!!errors.due_at}
        />
        {err("due_at")}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={assign.isPending}>
          Assign task
        </Button>
      </DialogFooter>
    </form>
  );
}

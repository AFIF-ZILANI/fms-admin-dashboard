export type TaskStatus = "PENDING" | "DONE" | "CANCELLED";

export type TaskType = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
};

/** An assignable task from the catalogue. task_type null = a plain mark-done task. */
export type Task = {
  id: string;
  code: string;
  label: string;
  task_type_id: string | null;
  task_type: TaskType | null;
  is_active: boolean;
};

export type TaskAssignment = {
  id: string;
  employee_id: string;
  employee: { id: string; role: string; profile: { name: string } };
  assigned_by_id: string;
  task_id: string;
  task: Task;
  title: string;
  description: string | null;
  house_id: string | null;
  house: { id: string; name: string } | null;
  location_note: string | null;
  due_at: string;
  status: TaskStatus;
  completed_at: string | null;
  completion_note: string | null;
  created_at: string;
};

export const isOverdue = (a: TaskAssignment, now = Date.now()) =>
  a.status === "PENDING" && new Date(a.due_at).getTime() < now;

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

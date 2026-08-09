export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  changed_by_id: string;
  before_data: unknown;
  after_data: unknown;
  note: string | null;
  occurred_at: string;
};

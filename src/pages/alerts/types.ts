export const ALERT_TYPES = ["EMPLOYEE", "BATCH", "FEED", "MEDICINE", "SYSTEM"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_LEVELS = ["INFO", "WARNING", "CRITICAL"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_STATUSES = ["ACTIVE", "RESOLVED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const ALERT_ACTION_TYPES = ["PAY", "REASSIGN", "MARK_RESOLVED"] as const;
export type AlertActionType = (typeof ALERT_ACTION_TYPES)[number];

export type Alert = {
  id: string;
  title: string;
  description: string | null;
  type: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  related_id: string | null;
  action_type: AlertActionType | null;
  issued_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

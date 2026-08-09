export const EMPLOYEE_ROLES = ["MANAGER", "WORKER", "INTERN"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type EmployeeProfile = {
  id: string;
  email: string | null;
  name: string;
  mobile: string;
  address: string | null;
  is_active: boolean;
};

export type Employee = {
  id: string;
  profile_id: string;
  role: EmployeeRole;
  salary: string;
  joining_date: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
  profile: EmployeeProfile;
};

// Fixed point value per criterion (server snapshots this at entry time — see
// lib/performance-criteria.ts — mirrored here only for display, never sent
// as the source of truth). OTHER is the escape hatch: rater supplies ±1 to ±5.
export const FIXED_CRITERION_POINTS = {
  ATTENDANCE_PERFECT: 3,
  EARLY_PROBLEM_REPORT: 3,
  SUGGESTION_IMPLEMENTED: 3,
  ZERO_NEGLIGENT_LOSS: 2,
  ACCURATE_DATA_ENTRY: 2,
  BIOSECURITY_FOLLOWED: 2,
  HELPED_COWORKER: 2,
  EXTRA_TASK_COMPLETED: 2,
  TEAM_TARGET_HIT: 3,
  CONFLICT_RESOLVED: 2,
  FALSIFIED_RECORD: -5,
  NEGLIGENT_LOSS: -5,
  BIOSECURITY_VIOLATION: -4,
  CONCEALED_PROBLEM: -4,
  MISSED_CRITICAL_TASK: -3,
  EQUIPMENT_DAMAGE: -3,
  CONDUCT_ISSUE: -3,
  TEAM_SUPERVISION_FAILURE: -3,
  UNEXCUSED_ABSENCE: -2,
  PATTERN_LATENESS: -2,
} as const;

export type FixedCriterion = keyof typeof FIXED_CRITERION_POINTS;
export const CRITERIA = [
  "ATTENDANCE_PERFECT",
  "EARLY_PROBLEM_REPORT",
  "SUGGESTION_IMPLEMENTED",
  "ZERO_NEGLIGENT_LOSS",
  "ACCURATE_DATA_ENTRY",
  "BIOSECURITY_FOLLOWED",
  "HELPED_COWORKER",
  "EXTRA_TASK_COMPLETED",
  "TEAM_TARGET_HIT",
  "CONFLICT_RESOLVED",
  "FALSIFIED_RECORD",
  "NEGLIGENT_LOSS",
  "BIOSECURITY_VIOLATION",
  "CONCEALED_PROBLEM",
  "MISSED_CRITICAL_TASK",
  "EQUIPMENT_DAMAGE",
  "CONDUCT_ISSUE",
  "TEAM_SUPERVISION_FAILURE",
  "UNEXCUSED_ABSENCE",
  "PATTERN_LATENESS",
  "OTHER",
] as const satisfies readonly [...FixedCriterion[], "OTHER"];
export type Criterion = (typeof CRITERIA)[number];

/** 0 for OTHER (custom points, not fixed) — narrows past the union for callers. */
export function criterionPoints(c: Criterion): number {
  return c === "OTHER" ? 0 : FIXED_CRITERION_POINTS[c];
}

export type PerformanceScoreEntry = {
  id: string;
  employee_id: string;
  given_by_id: string;
  criterion: Criterion;
  points: number;
  reason: string;
  date: string;
  created_at: string;
  idempotency_key: string;
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  month: string;
  baseline_salary: string;
  score_sum: number;
  adjustment_percent: string;
  final_salary: string;
  created_at: string;
};

export const PAYROLL_CLAMP_MIN = -10;
export const PAYROLL_CLAMP_MAX = 20;

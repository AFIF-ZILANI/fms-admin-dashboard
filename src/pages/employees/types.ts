// GET /employee-roles is authoritative for a role's label and for which codes
// exist at all -- an admin can add, rename or deactivate roles from Settings,
// and that never touches this file. EMPLOYEE_ROLES / EMPLOYEE_ROLE_LABELS
// below are a last-resort fallback only, for a code that fetch hasn't
// returned yet (e.g. still loading) -- they already disagree with the
// database (MANAGER reads "Manager" there, "General Manager" here) and are
// not kept in sync with it.
export const EMPLOYEE_ROLES = ["MANAGER", "WORKER", "INTERN"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

// The farm's own words for the three original roles (docs/employee_hire.md).
// The Owner isn't here: they hold the trade licence, which is an Admins profile.
export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  MANAGER: "General Manager",
  WORKER: "Shed Worker",
  INTERN: "Intern",
};

/** Mirrors EDUCATION_LEVELS in server/src/validators/employee.validator.ts. */
export const EDUCATION_LEVELS = [
  "NONE",
  "PRIMARY",
  "JSC",
  "SSC",
  "DAKHIL",
  "HSC",
  "ALIM",
  "DIPLOMA",
  "BACHELOR",
  "MASTER",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  NONE: "No formal education",
  PRIMARY: "Primary (Class 5)",
  JSC: "JSC (Class 8)",
  SSC: "SSC",
  DAKHIL: "Dakhil",
  HSC: "HSC",
  ALIM: "Alim",
  DIPLOMA: "Diploma",
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
};

/**
 * Offered in the emergency-contact relationship dropdown. "Other" reveals a
 * free-text field, so the stored column is a plain string, not an enum.
 */
export const RELATIONSHIPS = [
  "Father",
  "Mother",
  "Spouse",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Uncle",
  "Aunt",
  "Cousin",
  "Friend",
  "Neighbour",
] as const;
export const RELATIONSHIP_OTHER = "Other";

export const MARITAL_STATUSES = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Optional, sensitive: it only decides who a festival bonus proposes. */
export const RELIGIONS = ["ISLAM", "HINDU", "CHRISTIANITY", "BUDDHISM", "OTHER"] as const;
export type Religion = (typeof RELIGIONS)[number];
export const RELIGION_LABELS: Record<Religion, string> = {
  ISLAM: "Islam",
  HINDU: "Hinduism",
  CHRISTIANITY: "Christianity",
  BUDDHISM: "Buddhism",
  OTHER: "Other",
};

export const EMPLOYMENT_STATUSES = ["APPOINTED", "PROBATION", "CONFIRMED", "TERMINATED"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  APPOINTED: "Appointed",
  PROBATION: "On probation",
  CONFIRMED: "Confirmed",
  TERMINATED: "Terminated",
};

export type Avatar = { id: string; public_id: string; image_url: string };

export type EmployeeProfile = {
  id: string;
  email: string | null;
  name: string;
  mobile: string;
  address: string | null;
  avatar_id: string | null;
  avatar: Avatar | null;
  is_active: boolean;
};

export type Employee = {
  id: string;
  profile_id: string;
  // A role code from GET /employee-roles — no longer one of a fixed 3, since
  // admins can add roles, so this is a plain string rather than EmployeeRole.
  role: string;
  // An override of the role's standard salary. Null means the role's figure
  // applies. fixed_wage is gone from this type -- it's always 0.9 × the
  // resolved salary, derived client-side, never stored on the employee.
  reference_salary: string | null;
  joining_date: string;
  rating: number | null;

  // hire profile — null on employees created before the hire-profile migration
  date_of_birth: string | null;
  marital_status: MaritalStatus | null;
  education: string | null;
  experience: string | null;
  experience_years: number | null;
  nid_number: string | null;
  /** Only on the single-employee endpoints -- never the list. */
  religion?: Religion | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  emergency_address: string | null;
  reference_employee_id: string | null;
  reference_employee: { id: string; profile: { name: string; mobile: string } } | null;
  reference_name: string | null;
  reference_phone: string | null;
  reference_address: string | null;
  employment_status: EmploymentStatus;
  probation_end_date: string | null;
  /** Their last day. Payroll is payable for this month, not later ones. */
  terminated_at: string | null;

  created_at: string;
  updated_at: string;
  profile: EmployeeProfile;
};

/**
 * A row from GET /employee-roles: the standard salary for a role, and how
 * many employees currently hold it. Named EmployeeRoleConfig, not
 * EmployeeRole -- that name is already the fixed MANAGER/WORKER/INTERN
 * union above, used by the roster filter and existing labels.
 */
export type EmployeeRoleConfig = {
  id: string;
  code: string;
  label: string;
  reference_salary: string;
  is_active: boolean;
  employee_count: number;
};

/**
 * Whole years elapsed, stepping back a year when this year's birthday hasn't
 * happened yet — the reason age is derived here and never stored.
 */
export function ageFrom(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

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

export const SCORE_ENTRY_STATUSES = ["ACTIVE", "DISPUTED", "VOIDED"] as const;
export type ScoreEntryStatus = (typeof SCORE_ENTRY_STATUSES)[number];

export type PerformanceScoreEntry = {
  id: string;
  employee_id: string;
  given_by_id: string;
  approved_by_id: string | null;
  criterion: Criterion;
  points: number;
  reason: string;
  /** The day it happened — what decides which month's payroll it lands in. */
  incident_date: string;
  notice_doc_url: string | null;
  status: ScoreEntryStatus;
  void_reason: string | null;
  acknowledged_at: string | null;
  created_at: string;
  idempotency_key: string;
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  month: string;
  reference_salary: string;
  fixed_wage: string;
  score_sum: number;
  adjustment_percent: number; // P — a clamped sum of integer points
  allowance: string;
  total_pay: string;
  locked_at: string;
  created_at: string;
};

export const PAYROLL_CLAMP_MIN = -10;
export const PAYROLL_CLAMP_MAX = 20;
/** The guaranteed wage is this share of the reference salary. */
export const FIXED_WAGE_RATIO = 0.9;
/** Allowance at P = 0, as a percent of R — so a zero-entry month pays exactly R. */
export const BASE_ALLOWANCE_PERCENT = 10;
/** Points at or below this need written notice to the employee first. */
export const NOTICE_REQUIRED_AT = -4;
/** Ceiling on OTHER, per employee per month, summed absolute. */
export const OTHER_MONTHLY_CAP = 5;

/** Mirrors server/src/lib/payroll-math.ts — pay is an allowance on top of a
 *  guaranteed wage, never a deduction from one. */
export function computePay(referenceSalary: number, scoreSum: number) {
  const adjustment_percent = Math.max(PAYROLL_CLAMP_MIN, Math.min(PAYROLL_CLAMP_MAX, scoreSum));
  const fixed_wage = Math.round(referenceSalary * FIXED_WAGE_RATIO);
  const allowance = Math.round((referenceSalary * (BASE_ALLOWANCE_PERCENT + adjustment_percent)) / 100);
  return { adjustment_percent, fixed_wage, allowance, total_pay: fixed_wage + allowance };
}

// No CASH: a wage paid in cash leaves nothing to audit, so it goes to a bank
// account or an MFS wallet. Mirrors PAYOUT_METHODS on the server.
export const PAYOUT_METHODS = ["BANK", "BKASH", "NAGAD", "ROCKET"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  BANK: "Bank transfer",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

/** What sending one wage costs the farm, by destination. Served by
 *  GET /payroll-payouts/fee-rates so the preview and the stored figure can't
 *  drift apart -- the server computes the one that gets written. */
export type PayoutFeeRates = Record<PayoutMethod, { percent: number; flat: number }>;

export const PAYOUT_STATUSES = ["PENDING", "SENT", "FAILED", "CONFIRMED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** Append-only: a change closes this row (active_to) and opens a new one. */
export type EmployeePayoutAccount = {
  id: string;
  employee_id: string;
  method: PayoutMethod;
  account_name: string;
  account_number: string;
  bank_name: string | null;
  branch_name: string | null;
  routing_number: string | null;
  holder_relation: string | null;
  verified_by_id: string | null;
  verified_at: string | null;
  active_from: string;
  active_to: string | null;
  created_at: string;
};

export type PayrollPayout = {
  id: string;
  /** Exactly one of payroll_record_id / bonus_id is set. */
  payroll_record_id: string | null;
  bonus_id: string | null;
  payout_account_id: string | null;
  method: PayoutMethod;
  account_number: string;
  amount: string;
  fee_paid_by_farm: string;
  transaction_ref: string | null;
  receipt_doc_url: string | null;
  status: PayoutStatus;
  paid_by_id: string | null;
  paid_at: string | null;
  created_at: string;
  payroll_record: { id: string; month: string; total_pay: string } | null;
  bonus: { id: string; amount: string; event: { id: string; name: string } } | null;
};

/** Assembled server-side by GET /payroll-records/:id/payslip. The account is
 *  masked to its last 4 digits there — the full number never reaches this. */
export type Payslip = {
  id: string;
  month: string;
  reference_salary: string;
  fixed_wage: string;
  score_sum: number;
  adjustment_percent: number;
  allowance: string;
  total_pay: string;
  employee: {
    id: string;
    name: string;
    mobile: string;
    // Whatever role code the server sends -- not the fixed union; see the
    // comment above EMPLOYEE_ROLES.
    role: string;
    joining_date: string;
  };
  entries: Array<{
    id: string;
    criterion: Criterion;
    points: number;
    reason: string;
    incident_date: string;
  }>;
  payout: {
    method: PayoutMethod;
    account_last4: string;
    amount: string;
    fee_paid_by_farm: string;
    status: PayoutStatus;
    transaction_ref: string | null;
    paid_at: string | null;
  } | null;
};

/**
 * Computed by GET /employees/kpis across the whole table — never reduced from a
 * page of employees, which would quietly under-report once the roster outgrows
 * one page.
 */
export type EmployeeKpis = {
  active_employees: number;
  wage_bill_projected: number;
  unpaid_wages: number;
  unpaid_runs: number;
  labour_cost_per_bird: number | null;
  last_month_wages: number;
  live_birds: number;
  payroll_missing: number;
  no_payout_account: number;
  probation_due: number;
  negative_performers: number;
  overdue_tasks: number;
  payout_overdue: boolean;
};

import type { PayoutStatus, Religion } from "@/pages/employees/types";

export type BonusEvent = {
  id: string;
  name: string;
  event_date: string;
  /** null = farm-wide. */
  religion: Religion | null;
  multiplier: string;
  min_service_months: number;
  prorate: boolean;
  created_at: string;
  _count?: { bonuses: number };
};

export type Bonus = {
  id: string;
  employee_id: string;
  amount: string;
  reference_salary: string;
  service_months: number;
  note: string | null;
  employee: { id: string; profile: { name: string } };
  payout: { id: string; status: PayoutStatus; paid_at: string | null } | null;
};

export type BonusEventDetail = BonusEvent & { bonuses: Bonus[] };

/** One employee in GET /bonus-events/:id/proposal. Decimals arrive as strings. */
export type ProposalRow = {
  employee_id: string;
  name: string;
  role: string;
  employment_status: string;
  religion: Religion | null;
  reference_salary: string;
  service_months: number;
  full_amount: string;
  proposed_amount: string;
  selected: boolean;
  reason: string | null;
  already_granted: boolean;
};

export type Proposal = { event: BonusEvent; rows: ProposalRow[] };

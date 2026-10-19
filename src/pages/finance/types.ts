export const COST_TYPES = ["DIRECT", "SHARED_PERIOD", "SHARED_CAPITAL"] as const;
export type CostType = (typeof COST_TYPES)[number];

export type Expense = {
  id: string;
  batch_id: string | null;
  category: string;
  cost_type: CostType;
  amount: string;
  date: string;
  remarks: string | null;
  recorded_by_id: string;
  created_at: string;
};

export type AssetDepreciation = {
  id: string;
  asset_id: string;
  batch_id: string;
  amount: string;
  computed_at: string;
  asset: {
    id: string;
    name: string;
    purchase_cost: string;
    purchase_date: string;
    useful_life_batches: number;
    status: string;
  };
};

export type FinancialDashboard = {
  month: string;
  revenue: string;
  expenses: string;
  gross_profit: string;
  outstanding_payables: string;
  outstanding_receivables: string;
  cash_position: string;
  cash_by_instrument: { instrument_id: string; label: string; balance: string }[];
};

export type FinanceAsset = {
  id: string;
  name: string;
};

export type BatchPnl = {
  batch_id: string;
  revenue: string;
  purchase_cost: string;
  direct_expenses: string;
  depreciation_share: string;
  shared_period_expenses_unallocated: string;
  profit: string;
};

/** GET /analytics/finance/summary -- one period's figures. Costs count what was used (batch P&L rules). */
export type CostLine = {
  kind: "CHICKS" | "STOCK" | "EXPENSE" | "DEPRECIATION" | "STOCK_LOSS";
  code: string;
  label: string;
  amount: number;
};
export type FinancePeriod = {
  from: string;
  to: string;
  revenue: number;
  costs: number;
  net_profit: number;
  margin: number | null;
  /** balances at the end of the period */
  cash: number;
  receivables: number;
  payables: number;
  cost_breakdown: CostLine[];
};
export type FinanceSummary = { current: FinancePeriod; previous: FinancePeriod };

/** GET /analytics/finance/monthly */
export type FinanceMonth = {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
  cash_in: number;
  cash_out: number;
  cash_end: number;
};

/** GET /analytics/finance/owed */
export type OwedSide = {
  total: number;
  buckets: { d0_30: number; d31_60: number; d60_plus: number };
  count: number;
  top: { id: string; name: string; due: number; oldest: string; records: number }[];
};
export type FinanceOwed = { receivables: OwedSide; payables: OwedSide };

/** GET /analytics/batches/:id/pnl -> .statement, and each row of GET /analytics/batches-pnl. */
export type StatementSection = "CHICKS" | "FEED" | "HEALTH" | "SUPPLIES" | "DIRECT" | "DEPRECIATION";
export type BatchStatement = {
  batch: {
    id: string;
    batch_code: string;
    breed: string;
    status: "RUNNING" | "CLOSED" | "SOLD";
    starting_date: string;
    actual_end_date: string | null;
    age_days: number;
  };
  revenue: { gross: number; discounts: number; net: number };
  cost_lines: { section: StatementSection; label: string; amount: number }[];
  costs: number;
  /** what the batch earned before its share of farm-wide costs */
  contribution: number;
  shared_costs: { total: number; by_category: { label: string; amount: number }[] };
  net_profit: number;
  margin: number | null;
  birds: { placed: number; died: number; sold: number; live: number; mortality_rate: number };
  kg: { sold: number; produced: number; feed: number | null };
  per_unit: {
    cost_per_bird: number | null;
    cost_per_kg: number | null;
    profit_per_bird: number | null;
    avg_price_per_kg: number | null;
    fcr: number | null;
  };
  money: { received: number; due: number };
};

/** GET /analytics/shared-costs -- farm-wide costs per month and their split by bird-days. */
export type SharedMonth = {
  month: string;
  total: number;
  allocated: number;
  overhead: number;
  bird_days: number;
  batches: { batch_id: string; batch_code: string; bird_days: number; share: number }[];
  expenses: { id: string; date: string; category: string; label: string; amount: number; remarks: string | null }[];
};

/** GET /expenses/summary -- the whole filtered set, not one page. */
export type ExpenseSummary = {
  count: number;
  total: number;
  direct: number;
  shared: number;
  capital: number;
  paid: number;
  unpaid: number;
  by_category: { code: string; label: string; amount: number }[];
};

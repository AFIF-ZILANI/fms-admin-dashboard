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

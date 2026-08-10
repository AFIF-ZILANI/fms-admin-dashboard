export const EXPENSE_CATEGORIES = [
  "LABOR",
  "ELECTRICITY",
  "WATER",
  "RENT",
  "TRANSPORT",
  "FUEL",
  "MAINTENANCE",
  "VET_FEE",
  "INTERNET",
  "MISC",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const COST_TYPES = ["DIRECT", "SHARED_PERIOD", "SHARED_CAPITAL"] as const;
export type CostType = (typeof COST_TYPES)[number];

export type Expense = {
  id: string;
  batch_id: string | null;
  category: ExpenseCategory;
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

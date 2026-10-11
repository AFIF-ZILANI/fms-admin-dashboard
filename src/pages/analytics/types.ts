export type FarmOverview = {
  active_batch_count: number;
  total_birds_alive: number;
  houses_occupied: number;
  houses_empty: number;
  employee_headcount: number;
  unresolved_alerts_by_level: Record<string, number>;
};

export type BatchPerformance = {
  batch_id: string;
  live_count: number;
  initial_chick_count: number;
  cumulative_died: number;
  cumulative_mortality_rate: number;
  age_days: number;
  expected_selling_date: string | null;
  actual_end_date: string | null;
  latest_average_weight_grams: string | null;
  latest_weight_date: string | null;
  /** Null when any of the batch's feed has no kg conversion -- a partial total would flatter FCR. */
  feed_kg: number | null;
  /** Null until the batch has a weighing. */
  weight_gain_kg: number | null;
  fcr: number | null;
  cost_to_date: string;
  cost_per_kg: string | null;
};

export type MortalityTrendPoint = {
  date: string;
  died: number;
  birds_alive: number;
  /** died / birds_alive, 0..1 */
  rate: number;
};

export type FeedTrendPoint = {
  date: string;
  unit: string;
  quantity: string;
};

export type SalesTrendPoint = {
  date: string;
  revenue: string;
  avg_price_per_kg: string;
};

export type SalesByProductLineRow = {
  category: string;
  revenue: string;
};

export type GradeDistributionRow = {
  grade: string;
  birds_count: number;
  revenue: string;
  /** Summed over the same window as `revenue`, so avg price/kg is
   * revenue/net_weight without a second, differently-windowed fetch. */
  net_weight: string;
};

export type PurchasesByCategoryRow = {
  category: string;
  total: string;
};

export type PurchasesTrendPoint = {
  date: string;
  total: string;
};

export type StockValueByCategoryRow = {
  category: string;
  total: string;
};

export type StockMovementTrendPoint = {
  date: string;
  in: string;
  out: string;
};

export type ConsumptionByCategoryRow = {
  category: string;
  total: string;
};

export type ConsumptionTrendPoint = {
  date: string;
  total: string;
};

export type WastageByCategoryRow = {
  category: string;
  total: string;
};

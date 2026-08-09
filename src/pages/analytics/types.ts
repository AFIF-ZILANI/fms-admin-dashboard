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
};

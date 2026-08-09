export const BIRD_BREEDS = ["CLASSIC", "HIBREED", "PAKISTHANI", "KEDERNATH", "FAOMI", "TIGER"] as const;
export type BirdBreed = (typeof BIRD_BREEDS)[number];

export const PHASES = ["BROODER", "GROWER"] as const;
export type Phase = (typeof PHASES)[number];

export const BATCH_STATUSES = ["RUNNING", "CLOSED", "SOLD"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const ALLOCATION_REASONS = ["TRANSFER", "ADJUSTMENT"] as const;
export type AllocationReason = (typeof ALLOCATION_REASONS)[number];

export const FEED_TYPES = ["PRE_STARTER", "STARTER", "GROWER", "FINISHER", "LAYER"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const TIME_PERIODS = ["MORNING", "NOON", "AFTERNOON", "EVENING", "NIGHT", "MIDNIGHT", "LATENIGHT"] as const;
export type TimePeriod = (typeof TIME_PERIODS)[number];

export type HouseBalance = {
  id: string;
  batch_id: string;
  house_id: string;
  quantity: number;
  updated_at: string;
  house: { id: string; name: string; type: string; number: number };
};

export type Batch = {
  id: string;
  batch_code: string;
  breed: BirdBreed;
  phase: Phase;
  status: BatchStatus;
  starting_date: string;
  expected_selling_date: string;
  actual_end_date: string | null;
  initial_chick_count: number;
  init_chicks_avg_wt: number;
  created_at: string;
  updated_at: string;
  houseBalances: HouseBalance[];
};

export type BatchHouseAllocation = {
  id: string;
  batch_id: string;
  from_house_id: string | null;
  to_house_id: string | null;
  quantity: number;
  reason: AllocationReason | "INITIAL";
  recorded_by_id: string;
  occurred_at: string;
};

export type MortalityLog = {
  id: string;
  batch_id: string;
  house_id: string;
  count_died: number;
  cause_note: string | null;
  date: string;
  recorded_by_id: string;
};

export type WeightRecord = {
  id: string;
  batch_id: string | null;
  house_id: string;
  average_wt_grams: string;
  sample_size: number;
  date: string;
  measured_by_id: string;
};

export type BatchFeedingProgram = {
  id: string;
  batch_id: string;
  feed_type: FeedType;
  item_id: string;
  start_day: number;
  end_day: number | null;
};

export type EnvironmentRecord = {
  id: string;
  batch_id: string;
  house_id: string;
  temperature_c: number;
  humidity_percent: number;
  ammonia_ppm: number;
  co2_ppm: number;
  air_pressure_hpa: number;
  time_period: TimePeriod;
  recorded_by_id: string;
  recorded_at: string;
};

/** Live bird count for a batch — sum of its current house balances. */
export function liveBirdCount(batch: Pick<Batch, "houseBalances">): number {
  return batch.houseBalances.reduce((sum, b) => sum + b.quantity, 0);
}

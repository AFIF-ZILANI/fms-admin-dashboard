// Run with `bun test src/pages/analytics` -- no web test runner is set up, bun's built-in one needs none.
import { expect, test } from "bun:test";
import { farmKpis } from "./farm-kpis";
import type { BatchPerformance } from "./types";

const NOW = Date.parse("2026-10-11T00:00:00Z");
const day = (offset: number) => new Date(NOW + offset * 86_400_000).toISOString();
const perf = (p: Partial<BatchPerformance>): BatchPerformance => ({
  batch_id: "b",
  live_count: 0,
  initial_chick_count: 0,
  cumulative_died: 0,
  cumulative_mortality_rate: 0,
  age_days: 0,
  expected_selling_date: null,
  actual_end_date: null,
  latest_average_weight_grams: null,
  latest_weight_date: null,
  feed_kg: null,
  weight_gain_kg: null,
  fcr: null,
  cost_to_date: "0",
  cost_per_kg: null,
  ...p,
});

test("pools ratios by bird count and counts sales due within 7 days", () => {
  const k = farmKpis(
    [
      perf({ initial_chick_count: 7500, cumulative_died: 150, live_count: 7300, feed_kg: 9000, weight_gain_kg: 6000, fcr: 1.5, expected_selling_date: day(-3) }),
      perf({ initial_chick_count: 500, cumulative_died: 50, live_count: 450, feed_kg: 100, weight_gain_kg: 50, fcr: 2, expected_selling_date: day(5) }),
      perf({ initial_chick_count: 2000, live_count: 2000, expected_selling_date: day(30) }), // no FCR, not due
    ],
    NOW,
  );
  expect(k.mortalityRate).toBeCloseTo(200 / 10000, 10); // not the 2.33% mean of per-batch rates
  expect(k.fcr).toBeCloseTo(9100 / 6050, 10);
  expect(k.fcrBatchCount).toBe(2);
  expect(k.dueBirds).toBe(7750);
  expect(k.dueBatchCount).toBe(2);
  expect(k.overdueBatchCount).toBe(1);
});

test("empty farm gives zero mortality and no FCR", () => {
  expect(farmKpis([], NOW)).toMatchObject({ mortalityRate: 0, fcr: null, dueBirds: 0 });
});

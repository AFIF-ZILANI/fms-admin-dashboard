import type { BatchPerformance } from "@/pages/analytics/types";

const WEEK_MS = 7 * 86_400_000;

/** Farm-level KPIs rolled up from the running batches' performance rows.
 * Ratios are pooled (sum of numerators / sum of denominators), not an average
 * of per-batch ratios -- a 200-bird batch must not weigh as much as a 7,500-bird one. */
export function farmKpis(performances: BatchPerformance[], now = Date.now()) {
  const died = performances.reduce((s, p) => s + p.cumulative_died, 0);
  const placed = performances.reduce((s, p) => s + p.initial_chick_count, 0);

  const withFcr = performances.filter((p) => p.fcr !== null);
  const feedKg = withFcr.reduce((s, p) => s + (p.feed_kg ?? 0), 0);
  const gainKg = withFcr.reduce((s, p) => s + (p.weight_gain_kg ?? 0), 0);

  const due = performances.filter(
    (p) => p.actual_end_date === null && p.expected_selling_date !== null && new Date(p.expected_selling_date).getTime() <= now + WEEK_MS,
  );

  return {
    mortalityRate: placed > 0 ? died / placed : 0,
    fcr: gainKg > 0 ? feedKg / gainKg : null,
    fcrBatchCount: withFcr.length,
    dueBirds: due.reduce((s, p) => s + p.live_count, 0),
    dueBatchCount: due.length,
    overdueBatchCount: due.filter((p) => new Date(p.expected_selling_date!).getTime() < now).length,
  };
}

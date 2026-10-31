/** One day of GET /analytics/batches/:id/stock `daily`. */
export type DayRow = {
  day: number;
  feed_cost: number;
  medicine_cost: number;
  vaccine_cost: number;
  other_cost: number;
  feed_kg: number;
  birds: number;
};

export type WeekRow = {
  week: number;
  feed_cost: number;
  medicine_cost: number;
  vaccine_cost: number;
  other_cost: number;
  feed_kg: number;
  /** Average grams of feed per live bird per day over the week; null with no feed or no birds. */
  feed_g_per_bird: number | null;
};

const r2 = (n: number) => Number(n.toFixed(2));

/** Feed is recorded once a week, not daily, so the charts read by week of the batch (days 1-7 = week 1).
 * Feed per bird divides by bird-days (each day's live birds, summed), so a partial last week isn't diluted. */
export function toWeeks(daily: DayRow[]): WeekRow[] {
  const weeks = new Map<number, WeekRow & { birdDays: number }>();
  for (const d of daily) {
    const week = Math.ceil(d.day / 7);
    const w = weeks.get(week) ?? {
      week,
      feed_cost: 0,
      medicine_cost: 0,
      vaccine_cost: 0,
      other_cost: 0,
      feed_kg: 0,
      feed_g_per_bird: null,
      birdDays: 0,
    };
    w.feed_cost += d.feed_cost;
    w.medicine_cost += d.medicine_cost;
    w.vaccine_cost += d.vaccine_cost;
    w.other_cost += d.other_cost;
    w.feed_kg += d.feed_kg;
    w.birdDays += d.birds;
    weeks.set(week, w);
  }
  return [...weeks.values()].map(({ birdDays, ...w }) => ({
    ...w,
    feed_cost: r2(w.feed_cost),
    medicine_cost: r2(w.medicine_cost),
    vaccine_cost: r2(w.vaccine_cost),
    other_cost: r2(w.other_cost),
    feed_kg: Number(w.feed_kg.toFixed(3)),
    feed_g_per_bird: birdDays > 0 && w.feed_kg > 0 ? Math.round((w.feed_kg * 1000) / birdDays) : null,
  }));
}

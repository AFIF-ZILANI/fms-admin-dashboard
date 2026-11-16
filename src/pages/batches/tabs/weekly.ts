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

export type FeedPeriod = {
  /** First and last day of the batch the period covers (a partial last period ends at the last day so far). */
  from: number;
  to: number;
  feed_kg: number;
  /** Average grams per live bird per day over the period; null with no feed or no birds. */
  feed_g_per_bird: number | null;
};

/** Feed only, grouped into blocks of `size` days of the batch (1 = daily, 7 = weekly, 10, 30 = monthly).
 * Same bird-days rate as toWeeks, so a weekly entry still reads as a daily rate. */
export function toFeedPeriods(daily: DayRow[], size: number): FeedPeriod[] {
  const periods = new Map<number, FeedPeriod & { birdDays: number }>();
  for (const d of daily) {
    const key = Math.ceil(d.day / size);
    const p = periods.get(key) ?? { from: d.day, to: d.day, feed_kg: 0, feed_g_per_bird: null, birdDays: 0 };
    p.to = d.day;
    p.feed_kg += d.feed_kg;
    p.birdDays += d.birds;
    periods.set(key, p);
  }
  return [...periods.values()].map(({ birdDays, ...p }) => ({
    ...p,
    feed_kg: Number(p.feed_kg.toFixed(3)),
    feed_g_per_bird: birdDays > 0 && p.feed_kg > 0 ? Math.round((p.feed_kg * 1000) / birdDays) : null,
  }));
}

export type FeedGainRow = {
  /** Weighed on `from` and again on `to`; the feed counted is days from..to-1 (weighed day 8 = days 1-7). */
  from: number;
  to: number;
  feed_g_per_bird: number;
  gain_g: number;
  /** Grams of feed per gram gained; null when there's no feed or no gain to divide by. */
  fcr: number | null;
};

/** Feed eaten between two weighings against the weight put on over them. Feed per bird divides by the
 * interval's average live birds, so deaths and sales in the middle don't inflate it. */
export function feedVsGain(daily: DayRow[], weighings: { day: number; weight: number }[]): FeedGainRow[] {
  return weighings.slice(1).map((w, i) => {
    const prev = weighings[i]!;
    const span = daily.filter((d) => d.day >= prev.day && d.day < w.day);
    const kg = span.reduce((s, d) => s + d.feed_kg, 0);
    const birdDays = span.reduce((s, d) => s + d.birds, 0);
    const feed = birdDays > 0 ? Math.round((kg * 1000 * span.length) / birdDays) : 0;
    const gain = Math.round(w.weight - prev.weight);
    return { from: prev.day, to: w.day, feed_g_per_bird: feed, gain_g: gain, fcr: feed > 0 && gain > 0 ? r2(feed / gain) : null };
  });
}

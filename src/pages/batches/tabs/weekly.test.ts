// Run with `bun test src/pages/batches`.
import { expect, test } from "bun:test";
import { toWeeks, type DayRow } from "./weekly";

const day = (d: number, feed_kg: number, birds: number, feed_cost = 0): DayRow => ({
  day: d,
  feed_cost,
  medicine_cost: 0,
  vaccine_cost: 0,
  other_cost: 0,
  feed_kg,
  birds,
});

test("a week's feed is spread over its bird-days, wherever in the week it was recorded", () => {
  // 7 days x 100 birds = 700 bird-days; 70 kg recorded once on day 7 -> 100 g/bird/day
  const daily = [1, 2, 3, 4, 5, 6].map((d) => day(d, 0, 100)).concat(day(7, 70, 100, 3500));
  expect(toWeeks(daily)).toEqual([
    { week: 1, feed_cost: 3500, medicine_cost: 0, vaccine_cost: 0, other_cost: 0, feed_kg: 70, feed_g_per_bird: 100 },
  ]);
});

test("a partial week divides by the days so far; a week with no feed has no rate", () => {
  const daily = [1, 2, 3, 4, 5, 6, 7].map((d) => day(d, 0, 100)).concat(day(8, 20, 100), day(9, 0, 100));
  const [w1, w2] = toWeeks(daily);
  expect(w1!.feed_g_per_bird).toBeNull();
  expect(w2).toMatchObject({ week: 2, feed_kg: 20, feed_g_per_bird: 100 }); // 20 kg / 200 bird-days
});

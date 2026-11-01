// Run with `bun test src/pages/batches` -- no web test runner is set up, bun's built-in one needs none.
import { afterEach, expect, test } from "bun:test";
import { cycleDay, dayStart } from "./cycle-day";
import { farmToday, setDayStartHour } from "../../lib/farm-day";

const placed = "2026-10-25T00:00:00.000Z";
/** An instant given as Dhaka wall-clock time (UTC+6), whatever zone the test machine is in. */
const dhaka = (m: number, d: number, h: number, min = 0) => new Date(Date.UTC(2026, m - 1, d, h - 6, min));

afterEach(() => setDayStartHour(0));

test("the placement day is Day 1 all day, and it ticks over at the farm's midnight", () => {
  expect(cycleDay(placed, dhaka(10, 25, 0))).toBe(1);
  expect(cycleDay(placed, dhaka(10, 25, 23, 59))).toBe(1);
  expect(cycleDay(placed, dhaka(10, 26, 0))).toBe(2);
  expect(cycleDay(placed, dhaka(11, 24, 9))).toBe(31);
});

test("with the farm day starting at 04:00, the small hours stay on the previous day", () => {
  setDayStartHour(4);
  expect(cycleDay(placed, dhaka(10, 26, 3, 59))).toBe(1);
  expect(cycleDay(placed, dhaka(10, 26, 4))).toBe(2);
  expect(farmToday(dhaka(11, 2, 1, 30))).toBe("2026-11-01");
  expect(farmToday(dhaka(11, 2, 4))).toBe("2026-11-02");
});

test("never below Day 1", () => {
  expect(cycleDay(placed, dhaka(10, 20, 9))).toBe(1);
});

test("dayStart: Day 1 is the placement date, Day 3 two days later", () => {
  expect(dayStart(placed, 1).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  expect(dayStart(placed, 3).toISOString()).toBe("2026-10-27T00:00:00.000Z");
});

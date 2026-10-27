// Run with `bun test src/pages/batches` -- no web test runner is set up, bun's built-in one needs none.
import { expect, test } from "bun:test";
import { cycleDay, dayStart } from "./cycle-day";

const placed = "2026-10-25T00:00:00.000Z";
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h);

test("the placement day is Day 1 all day, and it ticks over at midnight", () => {
  expect(cycleDay(placed, at(2026, 10, 25, 0))).toBe(1);
  expect(cycleDay(placed, at(2026, 10, 25, 23))).toBe(1);
  expect(cycleDay(placed, at(2026, 10, 26, 0))).toBe(2);
  expect(cycleDay(placed, at(2026, 11, 24))).toBe(31);
});

test("never below Day 1", () => {
  expect(cycleDay(placed, at(2026, 10, 20))).toBe(1);
});

test("dayStart: Day 1 is the placement date, Day 3 two days later", () => {
  expect(dayStart(placed, 1).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  expect(dayStart(placed, 3).toISOString()).toBe("2026-10-27T00:00:00.000Z");
});

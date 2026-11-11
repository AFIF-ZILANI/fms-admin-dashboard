// Run with `bun test src/lib` -- bun's built-in runner, no setup needed.
import { expect, test } from "bun:test";
import { discountAmount, lineNet } from "./discount";

test("a discount is a flat amount or a percent of what it discounts, matching the server", () => {
  expect(discountAmount(200, "FLAT", 20)).toBe(20);
  expect(discountAmount(200, "PERCENT", 10)).toBe(20);
  expect(discountAmount(200, undefined, 10)).toBe(0);
  expect(discountAmount(200, "FLAT", undefined)).toBe(0);
});

test("a line's net is its quantity times price less its own discount, in cents, never below zero", () => {
  expect(lineNet({ quantity: "2", unit_price: "100", discount_type: "FLAT", discount_value: "20" })).toBe(180);
  expect(lineNet({ quantity: 3, unit_price: 0.1 })).toBe(0.3);
  expect(lineNet({ quantity: 1, unit_price: 10, discount_type: "FLAT", discount_value: 50 })).toBe(0);
  expect(lineNet({})).toBe(0);
});

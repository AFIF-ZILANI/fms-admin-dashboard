// Run with `bun test src/lib`
import { expect, test } from "bun:test";
import { formatTk, formatTkCompact } from "./utils";

test("money always carries the taka sign, before any minus", () => {
  expect(formatTk(1250)).toBe("৳1,250");
  expect(formatTk("99.5")).toBe("৳99.5");
  expect(formatTk(-1200)).toBe("-৳1,200");
  expect(formatTkCompact(12000)).toBe("৳12K");
  expect(formatTkCompact(-1500000)).toBe("-৳1.5M");
});

// Run with `bun test src/lib`
import { expect, test } from "bun:test";
import { formatTk, formatTkCompact, formatTkShort } from "./utils";

test("money always carries the taka sign, before any minus", () => {
  expect(formatTk(1250)).toBe("৳1,250");
  expect(formatTk("99.5")).toBe("৳99.5");
  expect(formatTk(-1200)).toBe("-৳1,200");
  expect(formatTkCompact(12000)).toBe("৳12K");
  expect(formatTkCompact(450)).toBe("৳450");
  expect(formatTkCompact(100000)).toBe("৳1L");
  expect(formatTkCompact(-150000)).toBe("-৳1.5L");
  expect(formatTkCompact(10000000)).toBe("৳1Cr");
  expect(formatTkCompact(-25000000)).toBe("-৳2.5Cr");
});

test("KPI tiles stay exact under 1,000 and go short above it", () => {
  expect(formatTkShort(450.5)).toBe("৳450.5");
  expect(formatTkShort(2000)).toBe("৳2K");
  expect(formatTkShort(17000000)).toBe("৳1.7Cr");
  expect(formatTkShort(-300000000)).toBe("-৳30Cr");
});

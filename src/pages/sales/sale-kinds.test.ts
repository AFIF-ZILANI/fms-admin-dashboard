// Run with `bun test src/pages/sales` -- no web test runner is set up, bun's built-in one needs none.
import { expect, test } from "bun:test";
import { itemFitsKind, scanLabel } from "./sale-kinds";

const coded = { id: "c", is_unit_tracked: true, is_farm_made: false, category: "MEDICINE" };
const heater = { id: "e", is_unit_tracked: true, is_farm_made: false, category: "EQUIPMENT" };
const feed = { id: "f", is_unit_tracked: false, is_farm_made: false, category: "FEED" };
const litter = { id: "l", is_unit_tracked: false, is_farm_made: true, category: "WASTE" };

test("each kind takes only its own items, and QR sales never take equipment", () => {
  expect([coded, heater, feed, litter].map((i) => itemFitsKind(i, "CODED"))).toEqual([true, false, false, false]);
  expect([coded, heater, feed, litter].map((i) => itemFitsKind(i, "STOCK"))).toEqual([false, false, true, false]);
  expect([coded, heater, feed, litter].map((i) => itemFitsKind(i, "FARM_MADE"))).toEqual([false, false, false, true]);
});

test("scan progress reads as a count until every bottle is out", () => {
  expect(scanLabel(null)).toBeNull();
  expect(scanLabel({ needed: 5, scanned: 3 })).toEqual({ tone: "warning", label: "3 of 5 scanned" });
  expect(scanLabel({ needed: 2, scanned: 2 })).toEqual({ tone: "success", label: "Scanned" });
});

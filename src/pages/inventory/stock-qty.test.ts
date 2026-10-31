// Run with `bun test src/pages/inventory`
import { expect, test } from "bun:test";
import { formatStock } from "./stock-qty";

const feed = { unit: "KG", itemUnits: [{ id: "u", item_id: "i", unit: "BAG", factor_to_base: "50.0000", is_purchasable: true, is_usable: true }] };

test("feed reads as whole bags plus loose kg", () => {
  expect(formatStock(162.5, feed)).toBe("3 Bag 12.5 kg");
  expect(formatStock(150, feed)).toBe("3 Bag");
  expect(formatStock(0.3 * 500, feed)).toBe("3 Bag");
  expect(formatStock(20, feed)).toBe("20 kg");
});

test("items without a bag conversion keep their base unit", () => {
  expect(formatStock(12, { unit: "BOTTLE", itemUnits: [] })).toBe("12 bottle");
  expect(formatStock(4, { unit: "BAG", itemUnits: [] })).toBe("4 bag");
});

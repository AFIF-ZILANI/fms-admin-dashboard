// Run with `bun test src/pages/inventory`
import { expect, test } from "bun:test";
import { formatEntered, formatStock } from "./stock-qty";

const feed = { unit: "KG", itemUnits: [{ id: "u", item_id: "i", unit: "BAG", factor_to_base: "50.0000", is_purchasable: true, is_usable: true }] };

test("feed reads as whole bags plus loose kg", () => {
  expect(formatStock(162.5, feed)).toBe("3 Bag 12.5 kg");
  expect(formatStock(150, feed)).toBe("3 Bag");
  expect(formatStock(0.3 * 500, feed)).toBe("3 Bag");
  expect(formatStock(20, feed)).toBe("0 Bag 20 kg");
  expect(formatStock("1250.5", feed)).toBe("25 Bag 0.5 kg");
  expect(formatStock(-70, feed)).toBe("-1 Bag 20 kg");
});

test("entered quantities: base unit reads like stock, other units stay as entered", () => {
  expect(formatEntered(120, "KG", feed)).toBe("2 Bag 20 kg");
  expect(formatEntered(10, "BAG", feed)).toBe("10 Bag");
  expect(formatEntered(3, "ML", undefined)).toBe("3 ml");
});

test("items without a bag conversion keep their base unit", () => {
  expect(formatStock(12, { unit: "BOTTLE", itemUnits: [] })).toBe("12 bottle");
  expect(formatStock(4, { unit: "BAG", itemUnits: [] })).toBe("4 bag");
});

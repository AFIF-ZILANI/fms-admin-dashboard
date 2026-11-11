import { toCents } from "./utils";
import type { DiscountType } from "../pages/purchases/types";

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = { FLAT: "Flat amount", PERCENT: "Percent" };

/** Amount a discount removes from `gross` -- FLAT is a currency amount, PERCENT is 0-100 of gross.
 * Mirrors the server's computeDiscount (shared by purchases and sales) so the preview matches what is charged. */
export function discountAmount(gross: number, type: DiscountType | undefined, value: number | undefined): number {
  if (type === undefined || value === undefined || !Number.isFinite(value)) return 0;
  return type === "PERCENT" ? gross * (value / 100) : value;
}

export function lineGross(line?: { quantity?: unknown; unit_price?: unknown }): number {
  return (Number(line?.quantity) || 0) * (Number(line?.unit_price) || 0);
}

export function lineNet(line?: {
  quantity?: unknown;
  unit_price?: unknown;
  discount_type?: DiscountType | undefined;
  discount_value?: unknown;
}): number {
  const gross = lineGross(line);
  const value =
    line?.discount_value === undefined || line?.discount_value === "" ? undefined : Number(line.discount_value);
  return toCents(Math.max(0, gross - discountAmount(gross, line?.discount_type, value)));
}

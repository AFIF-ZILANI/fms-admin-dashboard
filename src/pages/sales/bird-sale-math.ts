/** The weighing-sheet arithmetic behind a bird sale, kept pure so the form, its live slip and the payload
 * all read the same numbers. Money and kg are rounded to 2 places the way the server stores them, so
 * the total shown is the total the server computes (net_weight × price_per_kg). */

export const SALE_PAYMENT_STATUSES = ["DUE", "FULL", "PARTIAL"] as const;
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number];

export type SaleInputs = {
  totalWeightKg: number;
  /** kg one crate holds; 0 = not given, so `cratesManual` is used instead */
  crateSizeKg: number;
  /** count a part-filled last crate as a whole crate */
  roundCrates: boolean;
  cratesManual: number;
  deductionPerCrateG: number;
  birds: number;
  pricePerKg: number;
  discount: number;
  payment: SalePaymentStatus;
  receivedPartial: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeSale(i: SaleInputs) {
  const cratesDerived = i.crateSizeKg > 0 && i.totalWeightKg > 0;
  // r3 first so 96 / 12 can't become 8.0000001 and round up to 9 crates
  const exactCrates = cratesDerived ? r3(i.totalWeightKg / i.crateSizeKg) : 0;
  const crates = cratesDerived ? (i.roundCrates ? Math.ceil(exactCrates) : r2(exactCrates)) : i.cratesManual;
  const deductionKg = r3((crates * i.deductionPerCrateG) / 1000);
  const netKg = r2(Math.max(0, i.totalWeightKg - deductionKg));
  const avgWeightG = i.birds > 0 && netKg > 0 ? r2((netKg * 1000) / i.birds) : null;
  const total = r2(netKg * i.pricePerKg);
  const discount = r2(Math.min(Math.max(0, i.discount), total));
  const final = r2(total - discount);
  const received = i.payment === "FULL" ? final : i.payment === "PARTIAL" ? r2(i.receivedPartial) : 0;
  return {
    cratesDerived,
    exactCrates,
    crates,
    deductionKg,
    netKg,
    avgWeightG,
    total,
    discount,
    final,
    received,
    due: r2(final - received),
  };
}

export type SaleFigures = ReturnType<typeof computeSale>;

/** The discount that makes the final amount come out at `final` -- the other direction of the same field. */
export const discountForFinal = (total: number, final: number) => r2(Math.max(0, total - final));

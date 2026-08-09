import { z } from "zod";

/**
 * An optional numeric field bound to a text/number input left blank as "".
 * `z.union([z.coerce.number(), z.literal("")])` looks right but isn't:
 * `Number("") === 0` in JS, so z.coerce.number() accepts "" and coerces it
 * to 0 — the empty-string branch never gets tried, and a blank field
 * silently submits 0 instead of "not set". Preprocessing "" to undefined
 * before the number schema ever sees it is what actually works.
 */
export function optionalNumber<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

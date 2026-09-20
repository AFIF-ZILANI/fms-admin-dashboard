/** Mirrors `ingestSaleSchema` on the server, which is PoultryScale's own
 * vocabulary rather than FMS's. Kept verbatim so the review screen can show the
 * operator exactly what their phone sent. */
export type PoultryScalePayload = {
  sale_id: string;
  batch_id?: string | null;
  batch_name?: string | null;
  sale_date: string;
  is_pcs_tracked: boolean;
  has_cull: boolean;
  main: {
    weight_kg: number;
    net_weight_kg: number;
    pcs?: number | null;
    avg_wt_grams?: number | null;
    price_per_kg: number;
    amount: number;
    total_crates: number;
    deduction_per_crate_g: number;
    total_deduction_wt_kg: number;
    is_full_crates_only: boolean;
  };
  cull?: {
    is_sold: boolean;
    weight_kg: number;
    pcs?: number | null;
    sale_type?: "pcs" | "weight" | null;
    price?: number | null;
    amount?: number | null;
  } | null;
  buyer_name?: string | null;
  buyer_type?: "wholesaler" | "retail" | "direct" | null;
  final_amount: number;
  received_amount: number;
};

export type IngestedSale = {
  id: string;
  source: string;
  idempotency_key: string;
  portion: "main" | "cull";
  status: "PENDING" | "CONFIRMED" | "DISMISSED";
  payload: PoultryScalePayload;
  /** What the phone claimed, from its own clock. */
  device_sale_date: string;
  /** When FMS actually received it. The two disagree when a phone was offline. */
  received_at: string;
  bird_sale_id: string | null;
  dismissed_reason: string | null;
  recorded_by: { id: string; name: string };
  device: { id: string; label: string };
};

/** The portion being reviewed decides which half of the payload is in play:
 * a session's cull birds are a separate FMS sale from its main birds. */
export function portionFigures(row: IngestedSale) {
  const p = row.payload;
  if (row.portion === "cull" && p.cull) {
    return {
      birds: p.cull.pcs ?? null,
      // The device never deducts crates from the cull portion, so gross is net.
      totalWeight: p.cull.weight_kg,
      netWeight: p.cull.weight_kg,
      // A cull sold per piece has no price per kg at all -- derived here so the
      // reviewer has a starting figure, and editable because it is a guess.
      pricePerKg:
        p.cull.sale_type === "weight"
          ? (p.cull.price ?? 0)
          : p.cull.weight_kg > 0
            ? (p.cull.amount ?? 0) / p.cull.weight_kg
            : 0,
      amount: p.cull.amount ?? 0,
      crates: 0,
      deductionPerCrateG: 0,
    };
  }
  return {
    birds: p.main.pcs ?? null,
    totalWeight: p.main.weight_kg,
    netWeight: p.main.net_weight_kg,
    pricePerKg: p.main.price_per_kg,
    amount: p.main.amount,
    crates: p.main.total_crates,
    deductionPerCrateG: p.main.deduction_per_crate_g,
  };
}

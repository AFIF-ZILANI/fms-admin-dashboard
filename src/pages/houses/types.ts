export const HOUSE_TYPES = ["BROODER", "GROWER", "LAYER"] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];

/** Turnaround stage an operator sets on an empty house. Ignored while birds are in it. */
export const HOUSE_PHASES = ["READY", "CLEANING", "DISINFECTING", "RESTING", "MAINTENANCE"] as const;
export type HousePhase = (typeof HOUSE_PHASES)[number];

/** One batch currently holding birds in this house (docs/api.md — GET /api/houses). */
export type HouseOccupant = {
  batch_id: string;
  batch_code: string;
  batch_status: "RUNNING" | "CLOSED" | "SOLD";
  /** Birds still in this house now. */
  alive: number;
  /** Every bird ever moved into this house for that batch, initial placement included. */
  placed: number;
  since: string;
  expected_selling_date: string;
};

export type House = {
  id: string;
  name: string;
  type: HouseType;
  number: number;
  capacity: number | null;
  phase: HousePhase;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** GET /api/houses enriches every row with its occupancy; GET /api/houses/:id does not. */
export type HouseListRow = House & {
  occupants: HouseOccupant[];
  /** When the last batch left — drives the post-flock cleaning window. Null if never occupied. */
  last_vacated_at: string | null;
};

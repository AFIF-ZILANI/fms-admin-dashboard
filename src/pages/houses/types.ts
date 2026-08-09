export const HOUSE_TYPES = ["BROODER", "GROWER", "LAYER"] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];

export type House = {
  id: string;
  name: string;
  type: HouseType;
  number: number;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

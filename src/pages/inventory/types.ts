export const RESOURCE_CATEGORIES = [
  "FEED",
  "MEDICINE",
  "VACCINE",
  "SUPPLEMENT",
  "BIOSECURITY",
  "CHICKS",
  "HUSK",
  "EQUIPMENT",
  "UTILITIES",
  "SALARY",
  "TRANSPORTATION",
  "MAINTENANCE",
  "CLEANING_SUPPLIES",
  "OTHER",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const UNITS = [
  "BIRD",
  "KG",
  "LITER",
  "BAG",
  "BOX",
  "UNIT",
  "SACHETS",
  "BOTTLE",
  "ML",
  "L",
  "G",
  "PCS",
  "VIAL",
  "DOSE",
  "OTHER",
] as const;
export type Unit = (typeof UNITS)[number];

export const ORGANIZATION_ROLES = ["MANUFACTURER", "IMPORTER", "MARKETER", "DISTRIBUTOR"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export type Item = {
  id: string;
  name: string;
  normalized_key: string;
  category: ResourceCategory;
  unit: Unit;
  reorder_level: string | null;
  preferred_reorder_qty: string | null;
  lead_time_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Warehouse = {
  id: string;
  name: string;
  created_at: string;
};

export type Organization = {
  id: string;
  label_name: string;
  normalized_key: string;
  created_at: string;
  itemLinks?: { item: Item; role: OrganizationRole }[];
};

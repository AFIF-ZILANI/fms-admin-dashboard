export const SUPPLIER_ROLES = [
  "SALES_MAN",
  "OWNER",
  "DISTRIBUTOR",
  "DEALER",
  "WHOLESALER",
  "RETAILER",
  "MANUFACTURER",
  "IMPORTER",
  "REPRESENTATIVE",
] as const;
export type SupplierRole = (typeof SUPPLIER_ROLES)[number];

export const SUPPLY_CATEGORIES = [
  "FEED",
  "MEDICINE",
  "CHICKS",
  "HUSK",
  "EQUIPMENT",
  "UTILITIES",
  "TRANSPORTATION",
  "CLEANING_SUPPLIES",
  "OFFICE_SUPPLIES",
  "SOFTWARE",
  "OTHER",
] as const;
export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export type SupplierProfile = {
  id: string;
  email: string | null;
  name: string;
  mobile: string;
  address: string | null;
};

export type Supplier = {
  id: string;
  profile_id: string;
  role: SupplierRole;
  supplies: SupplyCategory[];
  company: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile: SupplierProfile;
};

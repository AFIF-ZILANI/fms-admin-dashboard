export const PAYMENT_DIRECTIONS = ["INCOMING", "OUTGOING"] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

// Payment.ref_type also allows EXPENSE/PAYROLL server-side, but those pages
// don't exist yet — only offer the 3 refs a payment can actually be recorded
// against today. Widen this list as Finance/Payroll ship.
export const PAYMENT_REF_TYPES = ["SALE", "BIRD_SALE", "PURCHASE"] as const;
export type PaymentRefType = (typeof PAYMENT_REF_TYPES)[number];

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MFS"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MFS_TYPES = ["BKASH", "NAGAD", "ROCKET"] as const;
export type MfsType = (typeof MFS_TYPES)[number];

export const OWNER_TYPES = ["ADMIN", "EMPLOYEE", "CUSTOMER", "SUPPLIER", "DOCTOR"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export type Payment = {
  id: string;
  amount: string;
  payment_date: string;
  direction: PaymentDirection;
  ref_type: PaymentRefType | "EXPENSE" | "PAYROLL";
  ref_id: string;
  from_instrument_id: string;
  to_instrument_id: string | null;
  transaction_ref: string | null;
  handled_by_id: string | null;
  note: string | null;
  created_at: string;
};

export type PaymentInstrument = {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  type: PaymentMethod;
  label: string;
  bank_name: string | null;
  account_no: string | null;
  mobile_no: string | null;
  mfs_type: MfsType | null;
  is_active: boolean;
  created_at: string;
};

export type InstrumentBalance = {
  instrument_id: string;
  incoming: string;
  outgoing: string;
  balance: string;
};

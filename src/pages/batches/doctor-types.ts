export type Doctor = {
  id: string;
  profile_id: string;
  specialty: string | null;
  position: string | null;
  degrees: string[];
  institution: string | null;
  profile: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    address: string | null;
    /** A doctor has no is_active of their own; deactivating flips the profile's. */
    is_active: boolean;
  };
  _count: { medications: number; vaccinations: number };
};

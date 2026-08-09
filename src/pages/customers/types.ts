export type CustomerProfile = {
  id: string;
  email: string | null;
  name: string;
  mobile: string;
  address: string | null;
};

export type Customer = {
  id: string;
  profile_id: string;
  company: string | null;
  rating: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile: CustomerProfile;
};

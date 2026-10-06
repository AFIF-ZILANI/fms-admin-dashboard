export type AdminProfile = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

export type Admin = {
  id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
  profile: AdminProfile;
};

/** The create response only: the temporary password, shown once. */
export type AdminCreated = Admin & { temp_password: string };

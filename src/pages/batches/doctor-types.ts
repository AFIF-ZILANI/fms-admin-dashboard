export type Doctor = {
  id: string;
  profile_id: string;
  specialty: string | null;
  position: string | null;
  degrees: string[];
  institution: string | null;
  rating: number | null;
  profile: { id: string; name: string };
};

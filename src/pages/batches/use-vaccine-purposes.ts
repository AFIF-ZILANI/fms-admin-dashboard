import { useGetData, type Paginated } from "@/lib/api";
import type { LookupRow } from "@/pages/settings/lookup-types";

/** Active vaccine purposes (Gumboro, Ranikhet...), managed in Settings → Vaccine templates. */
export function useVaccinePurposes() {
  const { data } = useGetData<Paginated<LookupRow>>("/vaccine-purposes?active=true&limit=100", [
    "vaccine-purposes",
    "active",
  ]);
  return data?.results ?? [];
}

import { useGetData, type Paginated } from "@/lib/api";
import type { Item } from "@/pages/inventory/types";

/** QR-coded vaccine items -- confirming a schedule row means scanning that item's bottles. */
export function useVaccineItems() {
  // ponytail: "VACCINE" is a live ItemCategory.code a user can rename via Settings (same caveat as
  // the feeding program's "FEED"); needs a stable key if renaming it becomes a real risk.
  const { data } = useGetData<Paginated<Item>>("/items?category=VACCINE&limit=100", ["items", "VACCINE"]);
  return (data?.results ?? []).filter((i) => i.is_unit_tracked);
}

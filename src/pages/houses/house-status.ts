import type { Tone } from "@/components/shared/status-badge";
import type { HouseListRow } from "@/pages/houses/types";

/** Days after the last flock leaves that a house counts as still being turned around
 * (wash, disinfect, rest) rather than ready for the next batch. ponytail: a flat
 * window, not a tracked workflow — give Houses a real phase field on the server if
 * operators need to mark "washing done" themselves. */
const TURNAROUND_DAYS = 14;

export type HousePhase = { tone: Tone; label: string; detail?: string };

/** Where a house is in its cycle, derived from occupancy — one mapping for the table,
 * the detail page and anywhere else that needs to say what a house is doing. */
export function housePhase(house: HouseListRow): HousePhase {
  const birds = house.occupants.reduce((sum, o) => sum + o.alive, 0);

  // No bird count in the detail -- the Flock column already carries it.
  if (birds > 0) return { tone: "success", label: "Flock in house" };
  if (!house.is_active) {
    return { tone: "warning", label: "Under maintenance", detail: "deactivated" };
  }
  if (house.last_vacated_at) {
    const daysEmpty = Math.floor((Date.now() - new Date(house.last_vacated_at).getTime()) / 86_400_000);
    if (daysEmpty <= TURNAROUND_DAYS) {
      return { tone: "info", label: "Cleaning & rest", detail: `day ${daysEmpty} since flock out` };
    }
    return { tone: "neutral", label: "Ready", detail: `empty ${daysEmpty} days` };
  }
  return { tone: "neutral", label: "Ready" };
}

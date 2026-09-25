import type { Tone } from "@/components/shared/status-badge";
import type { HouseListRow, HousePhase } from "@/pages/houses/types";

export const PHASE_LABEL: Record<HousePhase, string> = {
  READY: "Ready",
  CLEANING: "Washing",
  DISINFECTING: "Disinfecting",
  RESTING: "Resting",
  MAINTENANCE: "Maintenance",
};

export const PHASE_TONE: Record<HousePhase, Tone> = {
  READY: "neutral",
  CLEANING: "info",
  DISINFECTING: "info",
  RESTING: "info",
  MAINTENANCE: "warning",
};

export type HouseStatus = { tone: Tone; label: string; detail?: string };

/** What a house is doing right now: occupancy wins (it's a fact, derived from bird
 * balances), otherwise the turnaround phase an operator set on it. */
export function houseStatus(house: HouseListRow): HouseStatus {
  const birds = house.occupants.reduce((sum, o) => sum + o.alive, 0);
  // No bird count in the detail -- the Flock column already carries it.
  if (birds > 0) return { tone: "success", label: "Flock in house" };
  if (!house.is_active) return { tone: "neutral", label: "Inactive", detail: "deactivated" };

  return {
    tone: PHASE_TONE[house.phase],
    label: PHASE_LABEL[house.phase],
    detail: emptyFor(house.last_vacated_at),
  };
}

function emptyFor(lastVacatedAt: string | null): string | undefined {
  if (!lastVacatedAt) return undefined;
  const days = Math.floor((Date.now() - new Date(lastVacatedAt).getTime()) / 86_400_000);
  return days === 0 ? "flock out today" : `${days} days since flock out`;
}

import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { usePatchData } from "@/lib/api";
import { houseStatus, PHASE_LABEL } from "@/pages/houses/house-status";
import { HOUSE_PHASES, type House, type HouseListRow, type HousePhase } from "@/pages/houses/types";

/** Occupied or deactivated houses show a plain badge — there's no turnaround to
 * mark. An empty, active house gets the phase as an editable field right in the
 * table, so marking "washing done" is one click from the list. */
export function HousePhaseCell({ house }: { house: HouseListRow }) {
  const { tone, label, detail } = houseStatus(house);
  const setPhase = usePatchData<House, { phase: HousePhase }>(`/houses/${house.id}`, ["houses"]);

  const birds = house.occupants.reduce((sum, o) => sum + o.alive, 0);
  const editable = birds === 0 && house.is_active;

  if (!editable) {
    return (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge tone={tone} label={label} />
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <Select
        value={house.phase}
        onValueChange={(value) =>
          setPhase.mutate(
            { phase: value as HousePhase },
            {
              onSuccess: () => toast.success(`${house.name} marked ${PHASE_LABEL[value as HousePhase]}`),
              onError: (error) => toast.error(error.message),
            }
          )
        }
        disabled={setPhase.isPending}
      >
        <SelectTrigger size="sm" className="w-36" aria-label={`Turnaround phase for ${house.name}`}>
          <SelectValue>{(value: HousePhase | "") => (value ? PHASE_LABEL[value] : "Set phase")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {HOUSE_PHASES.map((phase) => (
            <SelectItem key={phase} value={phase}>
              {PHASE_LABEL[phase]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

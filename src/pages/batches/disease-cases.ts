import { useGetData, type Paginated } from "@/lib/api";
import type { LookupRow } from "@/pages/settings/lookup-types";
import { farmToday } from "@/lib/farm-day";
import type { DiseaseCase, DiseaseOutcome, DiseaseSeverity, MortalityLog } from "@/pages/batches/types";
import type { Tone } from "@/components/shared/status-badge";

/** A batch's disease cases, newest first. Shared by the Diseases page and the "Disease case" pickers. */
export function useDiseaseCases(batchId: string) {
  return useGetData<Paginated<DiseaseCase>>(`/disease-cases?batch_id=${batchId}&limit=100`, ["disease-cases", batchId]);
}

/** Active diseases (Newcastle, Gumboro...), managed in Settings → Vaccine templates. */
export function useDiseases() {
  const { data } = useGetData<Paginated<LookupRow>>("/diseases?active=true&limit=100", ["diseases", "active"]);
  return data?.results ?? [];
}

/** Cases a death could have been from: this house, and active on the farm day the birds died. The server
 *  checks the same window, so this list only spares the admin a refusal. */
export function casesForLog(cases: DiseaseCase[], log: MortalityLog) {
  const day = farmToday(new Date(log.date));
  return cases.filter(
    (c) =>
      c.houses.some((h) => h.id === log.house_id) &&
      c.noticed_on.slice(0, 10) <= day &&
      (!c.resolved_on || day <= c.resolved_on.slice(0, 10))
  );
}

export const SEVERITY_TONE: Record<DiseaseSeverity, Tone> = {
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "critical",
};

export const OUTCOME_LABEL: Record<DiseaseOutcome, string> = {
  RECOVERED: "Recovered",
  CULLED: "Culled",
  SOLD_EARLY: "Sold early",
};

/** Picking aid only: saved as plain text, and the form also takes symptoms not on this list. */
export const COMMON_SYMPTOMS = [
  "Coughing / sneezing",
  "Gasping / rattling",
  "Diarrhea",
  "Bloody droppings",
  "Drop in feed intake",
  "Drop in water intake",
  "Lethargy / huddling",
  "Ruffled feathers",
  "Swollen head / eyes",
  "Nasal discharge",
  "Twisted neck / paralysis",
  "Lameness",
  "Sudden deaths",
];

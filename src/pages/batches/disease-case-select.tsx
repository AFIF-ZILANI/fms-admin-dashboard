import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useDiseaseCases } from "@/pages/batches/disease-cases";

const NONE = "none";

/** Optional "which outbreak was this for" field on the medication and mortality forms. Lists the batch's
 *  open cases only -- and, given a house, only those affecting it. */
export function DiseaseCaseSelect({
  batchId,
  houseId,
  value,
  onChange,
}: {
  batchId: string;
  houseId?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data } = useDiseaseCases(batchId);
  const cases = (data?.results ?? []).filter(
    (c) => c.status === "ACTIVE" && (!houseId || c.houses.some((h) => h.id === houseId))
  );

  const label = (id: string) => {
    const c = cases.find((x) => x.id === id);
    return c ? `${c.disease.label} · since ${formatDate(c.noticed_on)}` : "None";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="disease_case_id">Disease (optional)</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)} disabled={!cases.length}>
        <SelectTrigger id="disease_case_id" className="w-full">
          <SelectValue>
            {(v: string) => (!cases.length ? "No open disease cases" : v === NONE ? "None" : label(v))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {cases.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {label(c.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

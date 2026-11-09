import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useDiseaseCases } from "@/pages/batches/disease-cases";

const NONE = "none";

/** Optional "which outbreak was this for" field on the medication and mortality forms. Hidden until the
 *  batch has a disease case, so batches that never got sick don't carry an empty field. */
export function DiseaseCaseSelect({
  batchId,
  value,
  onChange,
}: {
  batchId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data } = useDiseaseCases(batchId);
  const cases = data?.results ?? [];
  if (!cases.length) return null;

  const label = (id: string) => {
    const c = cases.find((x) => x.id === id);
    return c ? `${c.disease.label} · ${formatDate(c.noticed_on)}${c.status === "RESOLVED" ? " (resolved)" : ""}` : "None";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="disease_case_id">Disease case (optional)</Label>
      <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}>
        <SelectTrigger id="disease_case_id" className="w-full">
          <SelectValue>{(v: string) => (v === NONE ? "None" : label(v))}</SelectValue>
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { humanizeEnum } from "@/lib/utils";
import { VACCINE_METHODS, type VaccineMethod } from "@/pages/batches/types";
import { useVaccinePurposes } from "@/pages/batches/use-vaccine-purposes";

const NO_METHOD = "NONE";

/** Purpose dropdown. `fallbackLabel` names a purpose that has since been archived, so an old row still reads. */
export function PurposeSelect({
  value,
  onChange,
  fallbackLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  fallbackLabel?: string;
}) {
  const purposes = useVaccinePurposes();
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger aria-label="Purpose" className="w-full">
        <SelectValue>
          {(v: string) => purposes.find((p) => p.code === v)?.label ?? fallbackLabel ?? "Select purpose"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {purposes.map((p) => (
          <SelectItem key={p.code} value={p.code}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MethodSelect({
  value,
  onChange,
}: {
  value: VaccineMethod | null;
  onChange: (method: VaccineMethod | null) => void;
}) {
  return (
    <Select
      value={value ?? NO_METHOD}
      onValueChange={(v) => onChange(v === NO_METHOD ? null : (v as VaccineMethod))}
    >
      <SelectTrigger aria-label="Method" className="w-full">
        <SelectValue>{(v: string) => (v === NO_METHOD ? "No method" : humanizeEnum(v))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_METHOD}>No method</SelectItem>
        {VACCINE_METHODS.map((m) => (
          <SelectItem key={m} value={m}>
            {humanizeEnum(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

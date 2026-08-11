import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, type Paginated } from "@/lib/api";
import type { Doctor } from "@/pages/batches/doctor-types";

type DoctorSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
};

/** Optional doctor_id picker for Medications/Vaccinations entries — mirrors
 * ActorSelect's structure, sourced from Doctors instead of Admins. Value is
 * Doctors.id (not the underlying Profile's id), matching doctor_id's FK. */
export function DoctorSelect({ id, value, onChange }: DoctorSelectProps) {
  const { data } = useGetData<Paginated<Doctor>>("/doctors?limit=100", ["doctors"]);
  const doctors = data?.results ?? [];

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{(v: string) => doctors.find((d) => d.id === v)?.profile.name ?? "None"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {doctors.map((doctor) => (
            <SelectItem key={doctor.id} value={doctor.id}>
              {doctor.profile.name}
              {doctor.specialty ? ` — ${doctor.specialty}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {doctors.length === 0 && <p className="text-xs text-muted-foreground">No doctors on file yet.</p>}
    </div>
  );
}

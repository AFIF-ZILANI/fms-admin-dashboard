import { Link } from "react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, type Paginated } from "@/lib/api";

type ActorOption = { id: string; profile: { name: string } };

type ActorSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/**
 * Every write endpoint needs a `recorded_by_id`/`given_by_id` (no auth yet,
 * docs/PRD.md §5) — this is the one picker every such form reuses, sourced
 * from Admins since that's who uses this dashboard.
 */
export function ActorSelect({ id, value, onChange, invalid }: ActorSelectProps) {
  const { data } = useGetData<Paginated<ActorOption>>("/admins?limit=100", ["admins"]);
  const admins = data?.results ?? [];

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue>
            {(v: string) => admins.find((a) => a.id === v)?.profile.name ?? "Who's recording this?"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {admins.map((admin) => (
            <SelectItem key={admin.id} value={admin.id}>
              {admin.profile.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {admins.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No admins yet —{" "}
          <Link to="/admins" className="underline underline-offset-2">
            add one first
          </Link>
          .
        </p>
      )}
    </div>
  );
}

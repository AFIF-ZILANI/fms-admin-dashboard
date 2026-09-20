import { Link } from "react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, type Paginated } from "@/lib/api";

type ActorOption = { id: string; profile: { id: string; name: string } };

type ActorSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/**
 * Picks an Admin's Profile. Only for fields that genuinely name a person --
 * device pairing, for instance. "Who is doing this" is never picked here:
 * the server stamps it from the session (server/src/lib/current-actor.ts).
 */
export function ActorSelect({ id, value, onChange, invalid }: ActorSelectProps) {
  const { data } = useGetData<Paginated<ActorOption>>("/admins?limit=100", ["admins"]);
  const admins = data?.results ?? [];

  const handleChange = (v: string | null) => onChange(v ?? "");

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue>
            {(v: string) => admins.find((a) => a.profile.id === v)?.profile.name ?? "Select an admin"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* These fields foreign-key Profiles.id, not Admins.id — pass the profile's id. */}
          {admins.map((admin) => (
            <SelectItem key={admin.id} value={admin.profile.id}>
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

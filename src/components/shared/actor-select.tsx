import { useEffect } from "react";
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

// No auth yet (docs/PRD.md §5) — this remembers the last admin picked on this browser
// as a stand-in for "current user" and pre-selects it next time. Exported so pages that
// skip showing this picker entirely (e.g. the purchase form) can still resolve the same value.
export const LAST_ADMIN_KEY = "fms:last-admin-id";

/**
 * Every write endpoint needs a `recorded_by_id`/`given_by_id` (no auth yet,
 * docs/PRD.md §5) — this is the one picker every such form reuses, sourced
 * from Admins since that's who uses this dashboard.
 */
export function ActorSelect({ id, value, onChange, invalid }: ActorSelectProps) {
  const { data } = useGetData<Paginated<ActorOption>>("/admins?limit=100", ["admins"]);
  const admins = data?.results ?? [];

  useEffect(() => {
    if (value || admins.length === 0) return;
    const lastId = localStorage.getItem(LAST_ADMIN_KEY);
    if (lastId && admins.some((a) => a.profile.id === lastId)) onChange(lastId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admins.length]);

  const handleChange = (v: string | null) => {
    onChange(v ?? "");
    if (v) localStorage.setItem(LAST_ADMIN_KEY, v);
  };

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue>
            {(v: string) => admins.find((a) => a.profile.id === v)?.profile.name ?? "Who's recording this?"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* recorded_by_id/given_by_id foreign-key Profiles.id, not Admins.id — pass the profile's id. */}
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

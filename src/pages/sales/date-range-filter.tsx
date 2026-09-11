import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DateRangeFilterProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

/** Two labelled date inputs that can't be inverted: each bounds the other, and
 * both cap at today. The bare pair this replaces was two identical unlabelled
 * boxes where from > to silently returned an empty table with no explanation. */
export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="date_from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="date_from"
          type="date"
          className="w-40"
          value={from}
          max={to || today}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="date_to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="date_to"
          type="date"
          className="w-40"
          value={to}
          min={from || undefined}
          max={today}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
    </>
  );
}

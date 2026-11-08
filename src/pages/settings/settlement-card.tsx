import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetData, usePatchData } from "@/lib/api";

type FarmSettings = { day_start_hour: number; settlement_days: number };

/** How long a sold batch stays open for late costs and income before its books are final. */
export function SettlementCard() {
  const { data } = useGetData<FarmSettings>("/farm-settings", ["farm-settings"]);
  const saved = data?.settlement_days;
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (saved === undefined ? "" : String(saved));
  const days = Number(value);
  const valid = value !== "" && Number.isInteger(days) && days >= 0 && days <= 60;
  const save = usePatchData<FarmSettings, { settlement_days: number }>("/farm-settings", ["farm-settings"]);

  const onSave = () =>
    save.mutate(
      { settlement_days: days },
      {
        onSuccess: () => {
          toast.success("Settlement window saved");
          setDraft(null);
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" />
          Settlement window
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          After a batch is sold its books stay open this many days, so litter sales, a bottle nobody scanned or a late
          bill still count in its profit. Then the batch is finalised automatically and nothing more can be added. You
          can also finalise a batch early from its page.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settlement-days">Days open after sale</Label>
            <Input
              id="settlement-days"
              type="number"
              min={0}
              max={60}
              className="w-32"
              value={value}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!valid}
            />
          </div>
          <Button onClick={onSave} disabled={!valid || days === saved || save.isPending}>
            Save
          </Button>
        </div>
        {!valid && value !== "" && <p className="text-xs text-destructive">Between 0 and 60 days.</p>}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { usePatchData } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// Capped at 06:00 by the server: later would push stored dates (midnight UTC = 06:00 Dhaka) a day back.
const HOURS = [0, 1, 2, 3, 4, 5, 6];
const label = (h: number) => `${String(h).padStart(2, "0")}:00${h === 0 ? " (midnight)" : ""}`;

export function FarmDayCard() {
  const { me, refetch } = useAuth();
  const saved = me?.farm_day_start_hour ?? 0;
  const [hour, setHour] = useState(saved);
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const save = usePatchData<{ day_start_hour: number }, { day_start_hour: number }>("/farm-settings", ["farm-settings"]);

  const onSave = async () => {
    const ok = await confirm({
      title: "Change when the farm day starts?",
      description: `From now on the farm day turns over at ${label(hour)} Bangladesh time. Batch ages, "today", daily totals and charts all follow it, so entries logged between midnight and ${label(Math.max(hour, saved))} may move to a different day in reports.`,
      confirmLabel: "Change",
    });
    if (!ok) return;
    save.mutate(
      { day_start_hour: hour },
      {
        onSuccess: () => {
          toast.success("Farm day start saved");
          refetch();
          // Every day-derived number on screen (ages, charts, "today") is stale now.
          void queryClient.invalidateQueries();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4" />
          Farm day
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Night work belongs to the day it started. With the day starting at 04:00, a death logged at 01:30 counts
          for the previous day. Real times are always kept; only the day they count toward changes. The farm runs
          on Bangladesh time (UTC+6) whatever device opens it.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-start-hour">Farm day starts at</Label>
            <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
              <SelectTrigger id="day-start-hour" className="w-44">
                <SelectValue>{(v: string) => label(Number(v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {label(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onSave} disabled={hour === saved || save.isPending}>
            Save
          </Button>
        </div>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

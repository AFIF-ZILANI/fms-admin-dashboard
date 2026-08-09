import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const OPTIONS = [7, 30, 90] as const;

type DayRangeToggleProps = {
  value: number;
  onValueChange: (value: number) => void;
};

/** Segmented 7/30/90-day control shared by every trend chart on the
 * Analytics page. Each chart owns its own instance and its own fetch --
 * there's no shared/global range state (docs/analytics-dashboard-design.md §4.2). */
export function DayRangeToggle({ value, onValueChange }: DayRangeToggleProps) {
  return (
    <Tabs value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
      <TabsList>
        {OPTIONS.map((days) => (
          <TabsTrigger key={days} value={String(days)}>
            {days}d
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

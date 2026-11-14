import { useState, type ReactNode } from "react";
import { Bird, CalendarClock, CalendarDays, Home, Scale, Skull, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, humanizeEnum } from "@/lib/utils";
import { liveBirdCount, type Batch, type HouseBalance, type MortalityLog, type WeightRecord } from "@/pages/batches/types";
import { cycleDay } from "@/pages/batches/cycle-day";
import { useStartWeight } from "@/pages/batches/use-start-weight";

/** Overview stat: icon chip + label on one line, value, then a hint line that always takes
 * its space so every tile in the grid is the same height. */
function Stat({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className={`text-3xl leading-none font-semibold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>
            {value}
          </p>
        )}
        <p className="min-h-4 text-xs text-muted-foreground">{!isLoading && hint}</p>
      </CardContent>
    </Card>
  );
}

export function OverviewTab({ batch }: { batch: Batch }) {
  // Captured once per mount: Date.now() during render is impure (each re-render would shift it).
  const [now] = useState(() => Date.now());
  const { data: mortalityLogs, isLoading: mortalityLoading } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?batch_id=${batch.id}&limit=100`,
    ["mortality-logs", batch.id]
  );

  const { data: weightRecords, isLoading: weightLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batch.id}&limit=100`,
    ["weight-records", batch.id],
  );

  const startWeight = useStartWeight(batch.id).grams;
  const live = liveBirdCount(batch);
  const totalDied = (mortalityLogs?.results ?? []).reduce((sum, m) => sum + m.count_died, 0);
  const mortalityRate = batch.initial_chick_count > 0 ? (totalDied / batch.initial_chick_count) * 100 : 0;
  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);

  const daysToSelling = Math.ceil(
    (new Date(batch.expected_selling_date).getTime() - now) / (1000 * 60 * 60 * 24),
  );
  const latestWeight = (weightRecords?.results ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const columns: Column<HouseBalance>[] = [
    { key: "house", header: "House", render: (b) => b.house.name, sortValue: (b) => b.house.name },
    { key: "type", header: "Type", render: (b) => humanizeEnum(b.house.type), sortValue: (b) => b.house.type },
    {
      key: "quantity",
      header: "Birds",
      render: (b) => b.quantity.toLocaleString(),
      numeric: true,
      sortValue: (b) => b.quantity,
    },
    {
      key: "share",
      header: "Share of batch",
      render: (b) => (live > 0 ? `${((b.quantity / live) * 100).toFixed(1)}%` : "—"),
      numeric: true,
      sortValue: (b) => b.quantity,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Live birds" value={live.toLocaleString()} icon={Bird} hint={`of ${batch.initial_chick_count.toLocaleString()} placed`} />
        <Stat
          label="Cumulative mortality"
          value={`${mortalityRate.toFixed(1)}%`}
          icon={Skull}
          isLoading={mortalityLoading}
          hint={`${totalDied.toLocaleString()} birds died`}
        />
        <Stat
          label="Latest avg weight"
          value={latestWeight ? `${latestWeight.average_wt_grams.toLocaleString()} g` : "—"}
          icon={TrendingUp}
          isLoading={weightLoading}
          hint={latestWeight ? `sampled ${formatDate(latestWeight.date)}` : "no samples yet"}
        />
        <Stat label="Age" value={`Day ${cycleDay(batch.starting_date)}`} icon={CalendarDays} hint={`placed ${formatDate(batch.starting_date)}`} />
        <Stat
          label={batch.status === "RUNNING" && daysToSelling < 0 ? "Past selling date" : "Days to selling"}
          value={batch.status === "RUNNING" ? Math.abs(daysToSelling) : "—"}
          icon={CalendarClock}
          tone={batch.status === "RUNNING" && daysToSelling < 0 ? "warning" : undefined}
          hint={batch.status === "RUNNING" ? `expected ${formatDate(batch.expected_selling_date)}` : "batch ended"}
        />
        <Stat label="Start weight" value={startWeight === undefined ? "—" : `${startWeight.toLocaleString()} g`} icon={Scale} isLoading={weightLoading} hint="at placement" />
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Where the birds are"
          description={`${occupiedHouses.length} house${occupiedHouses.length === 1 ? "" : "s"} currently holding this batch`}
        />
        <DataTable
          columns={columns}
          rows={occupiedHouses}
          rowKey={(b) => b.id}
          empty={{
            icon: Home,
            title: "No houses currently occupied",
            description: "Record a house allocation to place these birds.",
          }}
        />
      </div>
    </div>
  );
}

import { Bird, Calendar, Home, Scale, Skull, TrendingUp } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import { liveBirdCount, type Batch, type HouseBalance, type MortalityLog, type WeightRecord } from "@/pages/batches/types";

function ageInDays(startingDate: string): number {
  return Math.floor((Date.now() - new Date(startingDate).getTime()) / (1000 * 60 * 60 * 24));
}

export function OverviewTab({ batch }: { batch: Batch }) {
  const { data: mortalityLogs, isLoading: mortalityLoading } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?batch_id=${batch.id}&limit=100`,
    ["mortality-logs", batch.id]
  );

  const { data: weightRecords, isLoading: weightLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batch.id}&limit=100`,
    ["weight-records", batch.id],
  );

  const live = liveBirdCount(batch);
  const totalDied = (mortalityLogs?.results ?? []).reduce((sum, m) => sum + m.count_died, 0);
  const mortalityRate = batch.initial_chick_count > 0 ? (totalDied / batch.initial_chick_count) * 100 : 0;
  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);

  const daysToSelling = Math.ceil(
    (new Date(batch.expected_selling_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Live birds" value={live.toLocaleString()} icon={Bird} hint={`of ${batch.initial_chick_count.toLocaleString()} placed`} />
        <KPICard
          label="Cumulative mortality"
          value={`${mortalityRate.toFixed(1)}%`}
          icon={Skull}
          isLoading={mortalityLoading}
          hint={`${totalDied.toLocaleString()} birds`}
        />
        <KPICard
          label="Latest avg weight"
          value={latestWeight ? `${formatMoney(latestWeight.average_wt_grams)} g` : "—"}
          icon={TrendingUp}
          isLoading={weightLoading}
          hint={latestWeight ? `sampled ${formatDate(latestWeight.date)}` : "no samples yet"}
        />
        <KPICard label="Age" value={`${ageInDays(batch.starting_date)} d`} icon={Calendar} />
        <KPICard
          label={batch.status === "RUNNING" && daysToSelling < 0 ? "Past selling date" : "Days to selling"}
          value={batch.status === "RUNNING" ? Math.abs(daysToSelling) : "—"}
          icon={Calendar}
          hint={batch.status === "RUNNING" ? undefined : "batch ended"}
        />
        <KPICard label="Start weight" value={`${batch.init_chicks_avg_wt} g`} icon={Scale} hint="at placement" />
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

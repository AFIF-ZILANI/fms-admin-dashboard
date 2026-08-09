import { Bird, Home, Skull } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { liveBirdCount, type Batch, type HouseBalance, type MortalityLog } from "@/pages/batches/types";

function ageInDays(startingDate: string): number {
  return Math.floor((Date.now() - new Date(startingDate).getTime()) / (1000 * 60 * 60 * 24));
}

export function OverviewTab({ batch }: { batch: Batch }) {
  const { data: mortalityLogs } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?batch_id=${batch.id}&limit=100`,
    ["mortality-logs", batch.id]
  );

  const live = liveBirdCount(batch);
  const totalDied = (mortalityLogs?.results ?? []).reduce((sum, m) => sum + m.count_died, 0);
  const mortalityRate = batch.initial_chick_count > 0 ? (totalDied / batch.initial_chick_count) * 100 : 0;
  const occupiedHouses = batch.houseBalances.filter((b) => b.quantity > 0);

  const columns: Column<HouseBalance>[] = [
    { key: "house", header: "House", render: (b) => b.house.name },
    { key: "type", header: "Type", render: (b) => humanizeEnum(b.house.type) },
    { key: "quantity", header: "Birds", render: (b) => b.quantity.toLocaleString(), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Live birds" value={live.toLocaleString()} icon={Bird} />
        <KPICard label="Houses occupied" value={occupiedHouses.length} icon={Home} />
        <KPICard label="Age (days)" value={ageInDays(batch.starting_date)} icon={Bird} />
        <KPICard label="Cumulative mortality" value={`${mortalityRate.toFixed(1)}%`} icon={Skull} />
      </div>

      <DataTable
        columns={columns}
        rows={occupiedHouses}
        rowKey={(b) => b.id}
        empty={{ icon: Home, title: "No houses currently occupied" }}
      />
    </div>
  );
}

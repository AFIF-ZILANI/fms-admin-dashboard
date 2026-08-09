import { useState } from "react";
import { Plus, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Batch, EnvironmentRecord } from "@/pages/batches/types";
import { EnvironmentFormDialog } from "@/pages/batches/tabs/environment-form-dialog";

export function EnvironmentTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useGetData<Paginated<EnvironmentRecord>>(
    `/environment-records?batch_id=${batch.id}&limit=100`,
    ["environment-records", batch.id]
  );

  const houseName = (id: string) => batch.houseBalances.find((b) => b.house_id === id)?.house.name ?? id;

  const columns: Column<EnvironmentRecord>[] = [
    { key: "recorded", header: "Recorded", render: (e) => new Date(e.recorded_at).toLocaleString() },
    { key: "house", header: "House", render: (e) => houseName(e.house_id) },
    { key: "period", header: "Time", render: (e) => humanizeEnum(e.time_period) },
    { key: "temp", header: "Temp (°C)", render: (e) => e.temperature_c, numeric: true },
    { key: "humidity", header: "Humidity (%)", render: (e) => e.humidity_percent, numeric: true },
    { key: "ammonia", header: "NH3 (ppm)", render: (e) => e.ammonia_ppm, numeric: true },
    { key: "co2", header: "CO2 (ppm)", render: (e) => e.co2_ppm, numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Log reading
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{ icon: Thermometer, title: "No environment readings logged for this batch" }}
      />

      <EnvironmentFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

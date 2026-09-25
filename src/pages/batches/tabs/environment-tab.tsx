import { useState } from "react";
import { Plus, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
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
    {
      key: "recorded",
      header: "Recorded",
      render: (e) => new Date(e.recorded_at).toLocaleString(),
      sortValue: (e) => e.recorded_at,
    },
    { key: "house", header: "House", render: (e) => houseName(e.house_id), sortValue: (e) => houseName(e.house_id) },
    { key: "period", header: "Time", render: (e) => humanizeEnum(e.time_period) },
    { key: "temp", header: "Temp (°C)", render: (e) => e.temperature_c, numeric: true, sortValue: (e) => Number(e.temperature_c) },
    { key: "humidity", header: "Humidity (%)", render: (e) => e.humidity_percent, numeric: true, sortValue: (e) => Number(e.humidity_percent) },
    { key: "ammonia", header: "NH3 (ppm)", render: (e) => e.ammonia_ppm, numeric: true, sortValue: (e) => Number(e.ammonia_ppm) },
    { key: "co2", header: "CO2 (ppm)", render: (e) => e.co2_ppm, numeric: true, sortValue: (e) => Number(e.co2_ppm) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Environment readings" description="Temperature, humidity, and air quality logged per house.">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Log reading
        </Button>
      </SectionHeader>

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).slice().sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        empty={{
          icon: Thermometer,
          title: "No environment readings logged for this batch",
          description: "Log a reading to start tracking house conditions.",
          action: { label: "Log reading", onClick: () => setFormOpen(true) },
        }}
        footer={data && data.total > data.results.length ? `Showing the latest ${data.results.length} of ${data.total} readings.` : undefined}
      />

      <EnvironmentFormDialog open={formOpen} onOpenChange={setFormOpen} batch={batch} />
    </div>
  );
}

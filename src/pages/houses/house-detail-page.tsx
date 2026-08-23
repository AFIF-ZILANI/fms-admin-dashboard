import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Bird, Package, Pencil, Skull, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import type { House } from "@/pages/houses/types";
import { HouseFormDialog } from "@/pages/houses/house-form-dialog";
import { HouseStockDialog } from "@/pages/houses/house-stock-dialog";

type BatchHouseBalance = { batch_id: string; house_id: string; quantity: number; batch?: { batch_code: string } };
type MortalityLog = { id: string; batch_id: string; count_died: number; cause_note: string | null; date: string };
type EnvironmentRecord = {
  id: string;
  date?: string;
  time_period: string;
  temperature_c: string;
  humidity_percent: string;
};

const TYPE_LABEL: Record<string, string> = { BROODER: "Brooder", GROWER: "Grower", LAYER: "Layer" };

export function HouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const { data: house, isLoading } = useGetData<House>(`/houses/${id}`, ["houses", id]);
  usePageTitle(house?.name ?? "House");

  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    `/batch-house-balances?house_id=${id}`,
    ["batch-house-balances", id],
    { enabled: !!id }
  );
  const { data: mortality } = useGetData<Paginated<MortalityLog>>(
    `/mortality-logs?house_id=${id}`,
    ["mortality-logs", id],
    { enabled: !!id }
  );
  const { data: environment } = useGetData<Paginated<EnvironmentRecord>>(
    `/environment-records?house_id=${id}`,
    ["environment-records", id],
    { enabled: !!id }
  );

  const deactivate = usePostData<House, void>(`/houses/${id}/deactivate`, ["houses"]);
  const reactivate = usePostData<House, void>(`/houses/${id}/reactivate`, ["houses"]);

  const toggleActive = () => {
    const mutation = house?.is_active ? deactivate : reactivate;
    mutation.mutate(undefined, {
      onSuccess: () => toast.success(house?.is_active ? "House deactivated" : "House reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const occupiedRows = (balances?.results ?? []).filter((b) => b.quantity > 0);
  const totalBirds = occupiedRows.reduce((sum, b) => sum + b.quantity, 0);

  const balanceColumns: Column<BatchHouseBalance>[] = [
    { key: "batch", header: "Batch", render: (b) => b.batch?.batch_code ?? b.batch_id },
    { key: "quantity", header: "Birds", render: (b) => b.quantity, numeric: true },
  ];

  const mortalityColumns: Column<MortalityLog>[] = [
    { key: "date", header: "Date", render: (m) => new Date(m.date).toLocaleDateString() },
    { key: "count", header: "Died", render: (m) => m.count_died, numeric: true },
    { key: "cause", header: "Cause", render: (m) => m.cause_note ?? "—" },
  ];

  const environmentColumns: Column<EnvironmentRecord>[] = [
    { key: "date", header: "Date", render: (e) => (e.date ? new Date(e.date).toLocaleDateString() : "—") },
    { key: "period", header: "Time", render: (e) => e.time_period },
    { key: "temp", header: "Temp (°C)", render: (e) => e.temperature_c, numeric: true },
    { key: "humidity", header: "Humidity (%)", render: (e) => e.humidity_percent, numeric: true },
  ];

  if (isLoading || !house) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tone, label } = activeStatus(house.is_active);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/houses")}>
        <ArrowLeft />
        Back to houses
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{house.name}</CardTitle>
              <StatusBadge tone={tone} label={label} />
            </div>
            <p className="text-sm text-muted-foreground">
              {TYPE_LABEL[house.type]} · House #{house.number}
              {house.capacity != null && ` · Capacity ${house.capacity} birds`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStockOpen(true)}>
              <Package />
              View stock
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button
              variant={house.is_active ? "destructive" : "default"}
              size="sm"
              onClick={toggleActive}
              disabled={deactivate.isPending || reactivate.isPending}
            >
              {house.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {totalBirds > 0
              ? `${totalBirds.toLocaleString()} birds currently housed here.`
              : "This house is currently empty."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Bird className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Current occupants</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={balanceColumns}
            rows={occupiedRows}
            rowKey={(b) => b.batch_id}
            empty={{ icon: Bird, title: "No batches in this house right now" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Skull className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Mortality history</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={mortalityColumns}
            rows={mortality?.results ?? []}
            rowKey={(m) => m.id}
            empty={{ icon: Skull, title: "No mortality recorded for this house" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Thermometer className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Environment readings</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={environmentColumns}
            rows={environment?.results ?? []}
            rowKey={(e) => e.id}
            empty={{ icon: Thermometer, title: "No environment readings logged for this house" }}
          />
        </CardContent>
      </Card>

      <HouseFormDialog open={editOpen} onOpenChange={setEditOpen} house={house} />
      <HouseStockDialog houseId={house.id} houseName={house.name} open={stockOpen} onOpenChange={setStockOpen} />
    </div>
  );
}

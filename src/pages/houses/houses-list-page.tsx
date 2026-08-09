import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, CheckCircle2, Home, Plus, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { HOUSE_TYPES, type House, type HouseType } from "@/pages/houses/types";
import { HouseFormDialog } from "@/pages/houses/house-form-dialog";

const TYPE_LABEL: Record<HouseType, string> = { BROODER: "Brooder", GROWER: "Grower", LAYER: "Layer" };

export function HousesListPage() {
  usePageTitle("Houses");
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<HouseType | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);

  // limit=100 (the API max) rather than paging — small enough house counts in
  // practice that this doubles as "fetch everything" for both the table and the stats below.
  const query = new URLSearchParams({ limit: "100" });
  if (typeFilter !== "ALL") query.set("type", typeFilter);
  const { data, isLoading } = useGetData<Paginated<House>>(`/houses?${query}`, ["houses", typeFilter]);

  const { data: balances } = useGetData<Paginated<{ quantity: number }>>(
    "/batch-house-balances?limit=100",
    ["batch-house-balances", "all"]
  );

  const houses = data?.results ?? [];
  const totalHouses = data?.total ?? houses.length;
  const activeHouses = houses.filter((h) => h.is_active).length;
  const totalCapacity = houses.reduce((sum, h) => sum + (h.capacity ?? 0), 0);
  const birdsHoused = (balances?.results ?? []).reduce((sum, b) => sum + b.quantity, 0);

  const columns: Column<House>[] = [
    { key: "name", header: "Name", render: (h) => <span className="font-medium">{h.name}</span> },
    { key: "type", header: "Type", render: (h) => TYPE_LABEL[h.type] },
    { key: "number", header: "Number", render: (h) => h.number, numeric: true },
    { key: "capacity", header: "Capacity", render: (h) => h.capacity ?? "—", numeric: true },
    {
      key: "status",
      header: "Status",
      render: (h) => {
        const { tone, label } = activeStatus(h.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total houses" value={totalHouses} icon={Home} />
        <KPICard label="Active" value={activeHouses} icon={CheckCircle2} />
        <KPICard label="Total capacity" value={totalCapacity > 0 ? totalCapacity.toLocaleString() : "—"} icon={Warehouse} />
        <KPICard label="Birds housed" value={birdsHoused.toLocaleString()} icon={Bird} />
      </div>

      <div className="flex items-center justify-between">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as HouseType | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {HOUSE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add house
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(h) => h.id}
        isLoading={isLoading}
        onRowClick={(h) => navigate(`/houses/${h.id}`)}
        empty={{
          icon: Home,
          title: "No houses yet",
          description: "Add your first house to start allocating batches.",
          action: { label: "Add house", onClick: () => setFormOpen(true) },
        }}
      />

      <HouseFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

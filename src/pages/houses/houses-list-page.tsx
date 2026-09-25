import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bird, CheckCircle2, Home, Plus, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { TruncatedText } from "@/components/shared/truncated-text";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { HOUSE_TYPES, type HouseListRow, type HouseType } from "@/pages/houses/types";
import { houseStatus } from "@/pages/houses/house-status";
import { HousePhaseCell } from "@/pages/houses/house-phase-cell";
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
  const { data, isLoading } = useGetData<Paginated<HouseListRow>>(`/houses?${query}`, ["houses", typeFilter]);

  const houses = data?.results ?? [];
  const totalHouses = data?.total ?? houses.length;
  const occupiedHouses = houses.filter((h) => h.occupants.length > 0);
  const birdsHoused = occupiedHouses.reduce(
    (sum, h) => sum + h.occupants.reduce((n, o) => n + o.alive, 0),
    0
  );
  const readyHouses = houses.filter((h) => h.is_active && h.occupants.length === 0).length;
  const totalCapacity = houses.reduce((sum, h) => sum + (h.capacity ?? 0), 0);

  const columns: Column<HouseListRow>[] = [
    {
      key: "name",
      header: "House",
      render: (h) => (
        <div className="flex flex-col">
          <span className="font-medium">{h.name}</span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABEL[h.type]} · #{h.number}
          </span>
        </div>
      ),
      sortValue: (h) => h.name,
    },
    {
      key: "batch",
      header: "Running batch",
      render: (h) =>
        h.occupants.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col">
            <Link
              to={`/batches/${h.occupants[0]!.batch_id}`}
              onClick={(e) => e.stopPropagation()}
              className="w-fit font-medium hover:underline"
            >
              <TruncatedText text={h.occupants[0]!.batch_code} />
            </Link>
            {h.occupants.length > 1 && (
              <span className="text-xs text-muted-foreground">+{h.occupants.length - 1} more in here</span>
            )}
          </div>
        ),
      sortValue: (h) => h.occupants[0]?.batch_code ?? "",
    },
    {
      key: "flock",
      header: "Flock",
      // Alive is the number that matters day to day; what was placed sits under it
      // so the gap (mortality + transfers out) is readable without a third column.
      render: (h) => {
        const alive = h.occupants.reduce((sum, o) => sum + o.alive, 0);
        const placed = h.occupants.reduce((sum, o) => sum + o.placed, 0);
        if (placed === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col items-end">
            <span className="font-medium tabular-nums">{alive.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground tabular-nums">of {placed.toLocaleString()} placed</span>
          </div>
        );
      },
      numeric: true,
      sortValue: (h) => h.occupants.reduce((sum, o) => sum + o.alive, 0),
    },
    {
      key: "since",
      header: "Running since",
      render: (h) => {
        const since = h.occupants.map((o) => o.since).sort()[0];
        if (!since) return <span className="text-muted-foreground">—</span>;
        const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
        return (
          <div className="flex flex-col">
            <span>{formatDate(since)}</span>
            <span className="text-xs text-muted-foreground">day {days}</span>
          </div>
        );
      },
      sortValue: (h) => h.occupants.map((o) => o.since).sort()[0] ?? "",
    },
    {
      key: "free",
      header: "Expected free",
      render: (h) => {
        // The last batch out is the one that frees the house.
        const free = h.occupants.map((o) => o.expected_selling_date).sort().at(-1);
        if (!free) return <span className="text-muted-foreground">—</span>;
        const days = Math.ceil((new Date(free).getTime() - Date.now()) / 86_400_000);
        return (
          <div className="flex flex-col">
            <span>{formatDate(free)}</span>
            <span className={days < 0 ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
              {days < 0 ? `${Math.abs(days)} days overdue` : `in ${days} days`}
            </span>
          </div>
        );
      },
      sortValue: (h) => h.occupants.map((o) => o.expected_selling_date).sort().at(-1) ?? "",
    },
    {
      key: "capacity",
      header: "Capacity",
      render: (h) => (h.capacity == null ? <span className="text-muted-foreground">—</span> : h.capacity.toLocaleString()),
      numeric: true,
      sortValue: (h) => h.capacity ?? 0,
    },
    {
      key: "status",
      header: "Status",
      render: (h) => <HousePhaseCell house={h} />,
      sortValue: (h) => houseStatus(h).label,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total houses" value={totalHouses} icon={Home} isLoading={isLoading} />
        <KPICard
          label="Occupied"
          value={occupiedHouses.length}
          icon={Bird}
          isLoading={isLoading}
          hint={birdsHoused > 0 ? `${birdsHoused.toLocaleString()} birds housed` : undefined}
        />
        <KPICard label="Ready" value={readyHouses} icon={CheckCircle2} isLoading={isLoading} hint="active and empty" />
        <KPICard
          label="Total capacity"
          value={totalCapacity > 0 ? totalCapacity.toLocaleString() : "—"}
          icon={Warehouse}
          isLoading={isLoading}
        />
      </div>

      <div className="flex items-center justify-between">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as HouseType | "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(value: HouseType | "ALL" | "") => (value && value !== "ALL" ? TYPE_LABEL[value] : "All types")}</SelectValue>
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

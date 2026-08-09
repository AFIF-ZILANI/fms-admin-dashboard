import { useState } from "react";
import { useNavigate } from "react-router";
import { Home, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
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

  const query = new URLSearchParams();
  if (typeFilter !== "ALL") query.set("type", typeFilter);
  const { data, isLoading } = useGetData<Paginated<House>>(`/houses?${query}`, ["houses", typeFilter]);

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

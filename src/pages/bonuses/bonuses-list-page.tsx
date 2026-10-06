import { useState } from "react";
import { useNavigate } from "react-router";
import { Gift, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { RELIGION_LABELS } from "@/pages/employees/types";
import type { BonusEvent } from "@/pages/bonuses/types";
import { EventFormDialog } from "@/pages/bonuses/event-form-dialog";

export function BonusesListPage() {
  usePageTitle("Bonuses");
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useGetData<Paginated<BonusEvent>>("/bonus-events?limit=100", ["bonus-events"]);

  const columns: Column<BonusEvent>[] = [
    { key: "name", header: "Event", render: (e) => <span className="font-medium">{e.name}</span> },
    { key: "date", header: "Date", render: (e) => formatDate(e.event_date) },
    { key: "for", header: "For", render: (e) => (e.religion ? RELIGION_LABELS[e.religion] : "Everyone") },
    { key: "multiplier", header: "Multiplier", numeric: true, render: (e) => `${Number(e.multiplier)} × salary` },
    { key: "granted", header: "Granted", numeric: true, render: (e) => e._count?.bonuses ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          A bonus is proposed per festival, then you choose who to pay. Nothing is granted until you confirm.
        </p>
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          New bonus event
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        onRowClick={(e) => navigate(`/bonuses/${e.id}`)}
        empty={{
          icon: Gift,
          title: "No bonus events yet",
          description: "Create one for the next festival.",
          action: { label: "New bonus event", onClick: () => setFormOpen(true) },
        }}
      />

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(event) => navigate(`/bonuses/${event.id}`)}
      />
    </div>
  );
}

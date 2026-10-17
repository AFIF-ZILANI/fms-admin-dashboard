import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, CalendarClock, Coins, Plus, Scale, Skull, TrendingUp, Wheat, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { TruncatedText } from "@/components/shared/truncated-text";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { BATCH_STATUSES, BIRD_BREEDS, PHASES, liveBirdCount, type Batch, type BatchStatus, type BirdBreed, type Phase } from "@/pages/batches/types";
import { BatchCreateDialog } from "@/pages/batches/batch-create-dialog";
import type { BatchPerformance } from "@/pages/analytics/types";

const STATUS_TONE: Record<BatchStatus, Tone> = { RUNNING: "success", CLOSED: "neutral", SOLD: "neutral" };

function ageInDays(startingDate: string): number {
  return Math.floor((Date.now() - new Date(startingDate).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function runningKpis(rows: BatchPerformance[]) {
  const initial = rows.reduce((s, r) => s + r.initial_chick_count, 0);
  const died = rows.reduce((s, r) => s + r.cumulative_died, 0);
  const worst = rows.reduce<BatchPerformance | null>(
    (w, r) => (!w || r.cumulative_mortality_rate > w.cumulative_mortality_rate ? r : w),
    null,
  );
  const weights = rows.flatMap((r) => (r.latest_average_weight_grams ? [Number(r.latest_average_weight_grams)] : []));
  const fcrs = rows.flatMap((r) => (r.fcr === null ? [] : [r.fcr]));
  const costs = rows.flatMap((r) => (r.cost_per_kg === null ? [] : [Number(r.cost_per_kg)]));
  const due = rows.filter((r) => r.expected_selling_date && daysUntil(r.expected_selling_date) <= 7).length;
  return {
    count: rows.length,
    live: rows.reduce((s, r) => s + r.live_count, 0),
    mortality: initial ? died / initial : null,
    worst,
    weight: avg(weights),
    fcr: avg(fcrs),
    costPerKg: avg(costs),
    cost: rows.reduce((s, r) => s + Number(r.cost_to_date), 0),
    due,
  };
}

export function BatchesListPage() {
  usePageTitle("Batches");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<BatchStatus | "ALL">("ALL");
  const [breedFilter, setBreedFilter] = useState<BirdBreed | "ALL">("ALL");
  const [phaseFilter, setPhaseFilter] = useState<Phase | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"starting_date" | "days_running" | "mortality_rate">("starting_date");
  const [createOpen, setCreateOpen] = useState(false);

  const query = new URLSearchParams({ limit: "100" });
  if (statusFilter !== "ALL") query.set("status", statusFilter);
  if (breedFilter !== "ALL") query.set("breed", breedFilter);
  if (phaseFilter !== "ALL") query.set("phase", phaseFilter);
  const { data, isLoading } = useGetData<Paginated<Batch>>(`/batches?${query}`, [
    "batches",
    statusFilter,
    breedFilter,
    phaseFilter,
  ]);

  const performanceQuery = new URLSearchParams();
  if (statusFilter !== "ALL") performanceQuery.set("status", statusFilter);
  const { data: performances } = useGetData<BatchPerformance[]>(
    `/analytics/batches/performance${performanceQuery.toString() ? `?${performanceQuery}` : ""}`,
    ["analytics", "batches-performance", statusFilter],
  );

  // KPIs describe the live flock, so they ignore the table filters.
  const { data: running, isLoading: runningLoading, isError: runningError } = useGetData<BatchPerformance[]>(
    "/analytics/batches/performance?status=RUNNING",
    ["analytics", "batches-performance", "RUNNING"],
  );

  const batches = data?.results ?? [];
  const kpis = runningKpis(running ?? []);

  const performanceByBatch = new Map((performances ?? []).map((p) => [p.batch_id, p]));
  const sortedBatches = [...batches].sort((a, b) => {
    // Running batches always sit on top; closed and sold are history, whatever
    // the chosen sort is.
    if ((a.status === "RUNNING") !== (b.status === "RUNNING"))
      return a.status === "RUNNING" ? -1 : 1;
    if (sortBy === "days_running") return ageInDays(b.starting_date) - ageInDays(a.starting_date);
    if (sortBy === "mortality_rate") {
      const rateA = performanceByBatch.get(a.id)?.cumulative_mortality_rate ?? 0;
      const rateB = performanceByBatch.get(b.id)?.cumulative_mortality_rate ?? 0;
      return rateB - rateA;
    }
    return new Date(b.starting_date).getTime() - new Date(a.starting_date).getTime();
  });

  const columns: Column<Batch>[] = [
    {
      key: "code",
      header: "Batch code",
      render: (b) => <TruncatedText text={b.batch_code} className="font-medium" />,
      sortValue: (b) => b.batch_code,
    },
    { key: "breed", header: "Breed", render: (b) => humanizeEnum(b.breed) },
    { key: "phase", header: "Phase", render: (b) => humanizeEnum(b.phase) },
    { key: "days", header: "Days running", render: (b) => ageInDays(b.starting_date), numeric: true },
    { key: "live", header: "Live birds", render: (b) => liveBirdCount(b).toLocaleString(), numeric: true },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadge tone={STATUS_TONE[b.status]} label={humanizeEnum(b.status)} />,
    },
    {
      key: "mortality",
      header: "Mortality",
      render: (b) => {
        const rate = performanceByBatch.get(b.id)?.cumulative_mortality_rate;
        if (rate === undefined) return "—";
        const tone = rate > 0.05 ? "critical" : rate > 0.02 ? "warning" : "success";
        return <StatusBadge tone={tone} label={`${(rate * 100).toFixed(1)}%`} />;
      },
      numeric: true,
    },
    {
      key: "selling",
      header: "Selling",
      render: (b) =>
        b.status === "RUNNING" && daysUntil(b.expected_selling_date) <= 7 ? (
          <StatusBadge tone="warning" label={daysUntil(b.expected_selling_date) <= 0 ? "Past due" : "Selling soon"} />
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Live birds" value={kpis.live.toLocaleString()} hint={`across ${kpis.count} running batches`} icon={Bird} isLoading={runningLoading} isError={runningError} />
        <KPICard
          label="Flock mortality"
          value={kpis.mortality === null ? "—" : `${(kpis.mortality * 100).toFixed(1)}%`}
          hint="deaths / chicks placed"
          icon={Skull}
          tone={kpis.mortality !== null && kpis.mortality > 0.05 ? "critical" : kpis.mortality !== null && kpis.mortality > 0.02 ? "warning" : undefined}
          isLoading={runningLoading}
          isError={runningError}
        />
        <KPICard
          label="Worst batch"
          value={kpis.worst ? `${(kpis.worst.cumulative_mortality_rate * 100).toFixed(1)}%` : "—"}
          hint={kpis.worst ? batches.find((b) => b.id === kpis.worst?.batch_id)?.batch_code ?? "highest mortality" : undefined}
          icon={TrendingUp}
          tone={kpis.worst && kpis.worst.cumulative_mortality_rate > 0.05 ? "critical" : undefined}
          isLoading={runningLoading}
          isError={runningError}
        />
        <KPICard
          label="Selling within 7 days"
          value={kpis.due}
          hint="includes past due"
          icon={CalendarClock}
          tone={kpis.due > 0 ? "warning" : undefined}
          isLoading={runningLoading}
          isError={runningError}
        />
        <KPICard label="Avg weight" value={kpis.weight === null ? "—" : `${Math.round(kpis.weight)} g`} hint="latest weighing per batch" icon={Scale} isLoading={runningLoading} isError={runningError} />
        <KPICard label="Avg FCR" value={kpis.fcr === null ? "—" : kpis.fcr.toFixed(2)} hint="feed kg per kg gained" icon={Wheat} isLoading={runningLoading} isError={runningError} />
        <KPICard label="Avg cost / kg" value={kpis.costPerKg === null ? "—" : formatMoney(kpis.costPerKg)} hint="per kg of live weight" icon={Coins} isLoading={runningLoading} isError={runningError} />
        <KPICard label="Spend to date" value={formatMoney(kpis.cost)} hint="running batches" icon={Wallet} isLoading={runningLoading} isError={runningError} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BatchStatus | "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>
                {(v: BatchStatus | "ALL" | "") => (v && v !== "ALL" ? humanizeEnum(v) : "All statuses")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {BATCH_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {humanizeEnum(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={breedFilter} onValueChange={(v) => setBreedFilter((v ?? "ALL") as BirdBreed | "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: BirdBreed | "ALL" | "") => (v && v !== "ALL" ? humanizeEnum(v) : "All breeds")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All breeds</SelectItem>
              {BIRD_BREEDS.map((breed) => (
                <SelectItem key={breed} value={breed}>
                  {humanizeEnum(breed)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={phaseFilter} onValueChange={(v) => setPhaseFilter((v ?? "ALL") as Phase | "ALL")}>
            <SelectTrigger className="w-36">
              <SelectValue>{(v: Phase | "ALL" | "") => (v && v !== "ALL" ? humanizeEnum(v) : "All phases")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All phases</SelectItem>
              {PHASES.map((phase) => (
                <SelectItem key={phase} value={phase}>
                  {humanizeEnum(phase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy((v ?? "starting_date") as typeof sortBy)}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {(v: string) =>
                  v === "days_running" ? "Sort: Days running" : v === "mortality_rate" ? "Sort: Mortality rate" : "Sort: Starting date"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starting_date">Sort: Starting date</SelectItem>
              <SelectItem value="days_running">Sort: Days running</SelectItem>
              <SelectItem value="mortality_rate">Sort: Mortality rate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create batch
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={sortedBatches}
        totalCount={data?.total}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        onRowClick={(b) => navigate(`/batches/${b.id}`)}
        empty={{
          icon: Bird,
          title: "No batches yet",
          description: "Create your first batch to place chicks into a house.",
          action: { label: "Create batch", onClick: () => setCreateOpen(true) },
        }}
      />

      <BatchCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

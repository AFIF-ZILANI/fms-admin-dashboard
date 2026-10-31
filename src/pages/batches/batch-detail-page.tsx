import { useState, type ComponentType } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData } from "@/lib/api";
import { formatDate, humanizeEnum } from "@/lib/utils";
import { BATCH_SECTIONS, type BatchSection } from "@/components/layout/nav-config";
import { liveBirdCount, type Batch, type BatchStatus } from "@/pages/batches/types";
import { BatchCloseDialog } from "@/pages/batches/batch-close-dialog";
import { OverviewTab } from "@/pages/batches/tabs/overview-tab";
import { AllocationsTab } from "@/pages/batches/tabs/allocations-tab";
import { MortalityTab } from "@/pages/batches/tabs/mortality-tab";
import { WeightTab } from "@/pages/batches/tabs/weight-tab";
import { FeedingProgramTab } from "@/pages/batches/tabs/feeding-program-tab";
import { EnvironmentTab } from "@/pages/batches/tabs/environment-tab";
import { TreatmentsTab } from "@/pages/batches/tabs/treatments-tab";
import { VaccineTab } from "@/pages/batches/tabs/vaccine-tab";
import { FinancialsTab } from "@/pages/batches/tabs/financials-tab";
import { cycleDay } from "@/pages/batches/cycle-day";

const STATUS_TONE: Record<BatchStatus, Tone> = { RUNNING: "success", CLOSED: "neutral", SOLD: "neutral" };

// Each section is its own page (/batches/:id/<section>); the sidebar is their navigation.
const SECTION_PAGES: Record<BatchSection, ComponentType<{ batch: Batch }>> = {
  overview: OverviewTab,
  allocations: AllocationsTab,
  mortality: MortalityTab,
  weight: WeightTab,
  feeding: FeedingProgramTab,
  treatments: TreatmentsTab,
  vaccines: VaccineTab,
  environment: EnvironmentTab,
  financials: FinancialsTab,
};

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
}

/** label over value, tabular — the header's at-a-glance facts (docs/design.md §3). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

// See docs/batches-redesign-design.md for the full page design.
export function BatchDetailPage() {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const navigate = useNavigate();
  const [closeOpen, setCloseOpen] = useState(false);

  const { data: batch, isLoading } = useGetData<Batch>(`/batches/${id}`, ["batches", id]);
  const active = BATCH_SECTIONS.find((s) => s.value === (section ?? "overview"));
  usePageTitle(`${batch?.batch_code ?? "Batch"} · ${active?.label ?? ""}`);

  if (!active || section === "overview") return <Navigate to={`/batches/${id}`} replace />;

  if (isLoading || !batch) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const SectionPage = SECTION_PAGES[active.value];
  const age = cycleDay(batch.starting_date);
  const cycleLength = Math.max(daysBetween(batch.starting_date, batch.expected_selling_date), 1);
  const progress = Math.min(Math.max(age / cycleLength, 0), 1);
  const daysToSelling = cycleLength - age;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" onClick={() => navigate("/batches")}>
        <ArrowLeft />
        Back to batches
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{batch.batch_code}</h1>
                <StatusBadge tone={STATUS_TONE[batch.status]} label={humanizeEnum(batch.status)} />
              </div>
              <p className="text-sm text-muted-foreground">
                {humanizeEnum(batch.breed)} · {humanizeEnum(batch.phase)} phase · started {formatDate(batch.starting_date)}
              </p>
            </div>
            {batch.status === "RUNNING" ? (
              <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
                <Lock />
                Close batch
              </Button>
            ) : (
              batch.actual_end_date && (
                <span className="text-sm text-muted-foreground">Ended {formatDate(batch.actual_end_date)}</span>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="Live birds" value={liveBirdCount(batch).toLocaleString()} />
            <Fact label="Initial chicks" value={batch.initial_chick_count.toLocaleString()} />
            <Fact label="Start weight" value={`${batch.init_chicks_avg_wt} g avg`} />
            <Fact label="Age" value={`Day ${age}`} />
            <Fact label="Expected selling" value={formatDate(batch.expected_selling_date)} />
          </div>

          {batch.status === "RUNNING" && (
            <div className="space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${daysToSelling < 0 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {daysToSelling >= 0
                  ? `${daysToSelling} day${daysToSelling === 1 ? "" : "s"} to expected selling`
                  : `${Math.abs(daysToSelling)} day${Math.abs(daysToSelling) === 1 ? "" : "s"} past expected selling`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section key={active.value} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
        <SectionPage batch={batch} />
      </section>

      <BatchCloseDialog open={closeOpen} onOpenChange={setCloseOpen} batch={batch} />
    </div>
  );
}

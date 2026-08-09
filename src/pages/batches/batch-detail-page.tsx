import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { liveBirdCount, type Batch, type BatchStatus } from "@/pages/batches/types";
import { BatchCloseDialog } from "@/pages/batches/batch-close-dialog";
import { OverviewTab } from "@/pages/batches/tabs/overview-tab";
import { AllocationsTab } from "@/pages/batches/tabs/allocations-tab";
import { MortalityTab } from "@/pages/batches/tabs/mortality-tab";

const STATUS_TONE: Record<BatchStatus, Tone> = { RUNNING: "success", CLOSED: "neutral", SOLD: "neutral" };

function ageInDays(startingDate: string): number {
  return Math.floor((Date.now() - new Date(startingDate).getTime()) / (1000 * 60 * 60 * 24));
}

// ponytail: only Overview/Allocations/Mortality are built this pass — Weight,
// Feeding Program, and Environment are the same "log a dated entry per house"
// shape and follow next; Treatments (needs a Doctor picker) and Financials
// (needs Purchases/Sales/Expenses, none built yet) come after that.
export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [closeOpen, setCloseOpen] = useState(false);

  const { data: batch, isLoading } = useGetData<Batch>(`/batches/${id}`, ["batches", id]);
  usePageTitle(batch?.batch_code ?? "Batch");

  if (isLoading || !batch) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/batches")}>
        <ArrowLeft />
        Back to batches
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{batch.batch_code}</CardTitle>
              <StatusBadge tone={STATUS_TONE[batch.status]} label={humanizeEnum(batch.status)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {humanizeEnum(batch.breed)} · {humanizeEnum(batch.phase)} phase · Day {ageInDays(batch.starting_date)} ·{" "}
              {liveBirdCount(batch).toLocaleString()} live birds
            </p>
          </div>
          {batch.status === "RUNNING" ? (
            <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
              <Lock />
              Close batch
            </Button>
          ) : (
            batch.actual_end_date && (
              <p className="text-xs text-muted-foreground">
                Ended {new Date(batch.actual_end_date).toLocaleDateString()}
              </p>
            )
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Started {new Date(batch.starting_date).toLocaleDateString()} · Expected selling{" "}
          {new Date(batch.expected_selling_date).toLocaleDateString()} · {batch.initial_chick_count.toLocaleString()}{" "}
          initial chicks @ {batch.init_chicks_avg_wt}g avg
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allocations">House Allocations</TabsTrigger>
          <TabsTrigger value="mortality">Mortality</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab batch={batch} />
        </TabsContent>
        <TabsContent value="allocations">
          <AllocationsTab batch={batch} />
        </TabsContent>
        <TabsContent value="mortality">
          <MortalityTab batch={batch} />
        </TabsContent>
      </Tabs>

      <BatchCloseDialog open={closeOpen} onOpenChange={setCloseOpen} batch={batch} />
    </div>
  );
}

import { useState } from "react";
import { CheckCircle2, HeartPulse, Loader2, Pencil, Pill, Plus, RotateCcw, Skull, Stethoscope, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useDelete, useGetData, usePatchData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { formatDate, humanizeEnum } from "@/lib/utils";
import { cycleDay } from "@/pages/batches/cycle-day";
import { OUTCOME_LABEL, SEVERITY_TONE, useDiseaseCases } from "@/pages/batches/disease-cases";
import { DiseaseCaseFormDialog } from "@/pages/batches/tabs/disease-case-form-dialog";
import type { Batch, DiseaseCase, DiseaseCaseDetail, DiseaseOutcome } from "@/pages/batches/types";

const dayOf = (batch: Batch, date: string) => cycleDay(batch.starting_date, new Date(date));

export function DiseasesTab({ batch }: { batch: Batch }) {
  const { data, isLoading } = useDiseaseCases(batch.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DiseaseCase | undefined>();
  const [resolving, setResolving] = useState<DiseaseCase | undefined>();
  const [viewingId, setViewingId] = useState<string | undefined>();

  const cases = data?.results ?? [];
  const active = cases.filter((c) => c.status === "ACTIVE");
  const history = cases.filter((c) => c.status === "RESOLVED");
  const canRecord = batch.status !== "CLOSED";

  const openForm = (c?: DiseaseCase) => {
    setEditing(c);
    setFormOpen(true);
  };

  const historyColumns: Column<DiseaseCase>[] = [
    { key: "disease", header: "Disease", render: (c) => c.disease.label, sortValue: (c) => c.disease.label },
    {
      key: "noticed",
      header: "Noticed",
      render: (c) => `${formatDate(c.noticed_on)} · day ${dayOf(batch, c.noticed_on)}`,
      sortValue: (c) => c.noticed_on,
    },
    { key: "resolved", header: "Resolved", render: (c) => (c.resolved_on ? formatDate(c.resolved_on) : "—") },
    { key: "houses", header: "Houses", render: (c) => c.houses.map((h) => h.name).join(", ") },
    {
      key: "severity",
      header: "Severity",
      render: (c) => <StatusBadge tone={SEVERITY_TONE[c.severity]} label={humanizeEnum(c.severity)} />,
    },
    { key: "deaths", header: "Deaths", numeric: true, render: (c) => c.deaths.toLocaleString(), sortValue: (c) => c.deaths },
    { key: "treatments", header: "Treatments", numeric: true, render: (c) => c.treatments, sortValue: (c) => c.treatments },
    { key: "outcome", header: "Outcome", render: (c) => (c.outcome ? OUTCOME_LABEL[c.outcome] : "—") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Active cases"
          description="Outbreaks still going on. Link treatments and deaths to a case from their own forms."
        >
          {canRecord && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus />
              Record case
            </Button>
          )}
        </SectionHeader>

        {isLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : active.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="size-5 text-success" />
              No active disease in this batch.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((c) => (
              <ActiveCaseCard
                key={c.id}
                batch={batch}
                diseaseCase={c}
                onView={() => setViewingId(c.id)}
                onEdit={() => openForm(c)}
                onResolve={() => setResolving(c)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader title="History" description="Resolved cases. Click a row to see its timeline." />
        <DataTable
          columns={historyColumns}
          rows={history}
          rowKey={(c) => c.id}
          isLoading={isLoading}
          onRowClick={(c) => setViewingId(c.id)}
          empty={{ icon: HeartPulse, title: "No resolved cases yet" }}
        />
      </div>

      <DiseaseCaseFormDialog batch={batch} existing={editing} open={formOpen} onOpenChange={setFormOpen} />
      {resolving && (
        <ResolveDialog batch={batch} diseaseCase={resolving} onOpenChange={(open) => !open && setResolving(undefined)} />
      )}
      <CaseSheet
        batch={batch}
        caseId={viewingId}
        onOpenChange={(open) => !open && setViewingId(undefined)}
        onEdit={(c) => {
          setViewingId(undefined);
          openForm(c);
        }}
        onResolve={(c) => {
          setViewingId(undefined);
          setResolving(c);
        }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Skull; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="size-4 text-muted-foreground" />
      <span className="font-medium tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ActiveCaseCard({
  batch,
  diseaseCase: c,
  onView,
  onEdit,
  onResolve,
}: {
  batch: Batch;
  diseaseCase: DiseaseCase;
  onView: () => void;
  onEdit: () => void;
  onResolve: () => void;
}) {
  const daysOpen = Math.max(cycleDay(c.noticed_on), 0);
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/40" onClick={onView}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="font-semibold">{c.disease.label}</p>
            <p className="text-xs text-muted-foreground">
              {c.houses.map((h) => h.name).join(", ")} · noticed day {dayOf(batch, c.noticed_on)} ({formatDate(c.noticed_on)}),{" "}
              {daysOpen === 0 ? "today" : `${daysOpen} day${daysOpen === 1 ? "" : "s"} ago`}
            </p>
          </div>
          <StatusBadge tone={SEVERITY_TONE[c.severity]} label={humanizeEnum(c.severity)} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Stat icon={Skull} label="deaths" value={c.deaths.toLocaleString()} />
          <Stat icon={Pill} label="treatments" value={c.treatments.toString()} />
          {c.affected_count !== null && <Stat icon={Stethoscope} label="sick" value={c.affected_count.toLocaleString()} />}
        </div>

        {c.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.symptoms.map((s) => (
              <span key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onResolve}>
            <CheckCircle2 />
            Resolve
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResolveDialog({
  batch,
  diseaseCase,
  onOpenChange,
}: {
  batch: Batch;
  diseaseCase: DiseaseCase;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  // Mounted only while open, so each resolve starts from today / Recovered.
  const [resolvedOn, setResolvedOn] = useState(farmToday());
  const [outcome, setOutcome] = useState<DiseaseOutcome>("RECOVERED");

  const patch = usePatchData<DiseaseCase, object>(`/disease-cases/${diseaseCase.id}`, ["disease-cases", batch.id]);

  const submit = () =>
    patch.mutate(
      { status: "RESOLVED", resolved_on: resolvedOn, outcome },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["disease-case"] });
          toast.success("Case resolved");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Resolve {diseaseCase.disease.label}</DialogTitle>
          <DialogDescription>When it ended and how.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolved_on">Resolved on</Label>
            <Input id="resolved_on" type="date" value={resolvedOn} onChange={(e) => setResolvedOn(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outcome">Outcome</Label>
            <Select value={outcome} onValueChange={(v) => v && setOutcome(v as DiseaseOutcome)}>
              <SelectTrigger id="outcome" className="w-full">
                <SelectValue>{(v: DiseaseOutcome) => OUTCOME_LABEL[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OUTCOME_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={patch.isPending || !resolvedOn}>
            {patch.isPending && <Loader2 className="animate-spin" />}
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TimelineEvent = { at: string; title: string; detail?: string; icon: typeof Skull };

function timeline(c: DiseaseCaseDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      at: c.noticed_on,
      title: `Noticed in ${c.houses.map((h) => h.name).join(", ")}`,
      detail: [c.symptoms.join(", "), c.notes].filter(Boolean).join(" — ") || undefined,
      icon: Stethoscope,
    },
    ...c.medications.map((m) => ({
      at: m.date,
      title: `Treated: ${m.medicine_name}`,
      detail: m.dosage,
      icon: Pill,
    })),
    ...c.mortalityLogs.map((m) => ({
      at: m.date,
      title: `${m.count_died.toLocaleString()} died in ${m.house.name}`,
      detail: m.cause_note ?? undefined,
      icon: Skull,
    })),
  ];
  if (c.resolved_on)
    events.push({ at: c.resolved_on, title: `Resolved: ${c.outcome ? OUTCOME_LABEL[c.outcome] : ""}`, icon: CheckCircle2 });
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function CaseSheet({
  batch,
  caseId,
  onOpenChange,
  onEdit,
  onResolve,
}: {
  batch: Batch;
  caseId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (c: DiseaseCase) => void;
  onResolve: (c: DiseaseCase) => void;
}) {
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: c } = useGetData<DiseaseCaseDetail>(`/disease-cases/${caseId}`, ["disease-case", caseId], {
    enabled: !!caseId,
  });
  const key = ["disease-cases", batch.id];
  const reopen = usePatchData<DiseaseCase, object>(`/disease-cases/${caseId}`, key);
  const remove = useDelete<null, string>((id) => `/disease-cases/${id}`, key);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["disease-case", caseId] });

  const onRemove = async () => {
    if (!c) return;
    const ok = await confirm({
      title: `Remove this ${c.disease.label} case?`,
      description: "For a case entered by mistake. Its treatments and deaths stay on the batch, unlinked.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    void remove.mutate(c.id, {
      onSuccess: () => {
        toast.success("Case removed");
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <>
      <Sheet open={!!caseId} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {!c || c.id !== caseId ? (
            <Skeleton className="m-4 h-64" />
          ) : (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {c.disease.label}
                  <StatusBadge tone={SEVERITY_TONE[c.severity]} label={humanizeEnum(c.severity)} />
                </SheetTitle>
                <SheetDescription>
                  {c.status === "ACTIVE" ? "Active" : `Resolved ${c.resolved_on ? formatDate(c.resolved_on) : ""}`} ·{" "}
                  {humanizeEnum(c.diagnosis_method)}
                  {c.doctor ? ` by ${c.doctor.profile.name}` : ""} · recorded by {c.recorded_by.name}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 pb-6">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <Stat icon={Skull} label="deaths" value={c.deaths.toLocaleString()} />
                  <Stat icon={Pill} label="treatments" value={c.treatments.toString()} />
                  {c.affected_count !== null && (
                    <Stat icon={Stethoscope} label="sick" value={c.affected_count.toLocaleString()} />
                  )}
                </div>

                <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
                  {timeline(c).map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[29px] flex size-6 items-center justify-center rounded-full border border-border bg-background">
                        <e.icon className="size-3.5 text-muted-foreground" />
                      </span>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(e.at)} · day {dayOf(batch, e.at)}
                      </p>
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.detail && <p className="text-sm text-muted-foreground">{e.detail}</p>}
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                  {c.status === "ACTIVE" ? (
                    <Button size="sm" variant="outline" onClick={() => onResolve(c)}>
                      <CheckCircle2 />
                      Resolve
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reopen.isPending}
                      onClick={() =>
                        reopen.mutate(
                          { status: "ACTIVE" },
                          {
                            onSuccess: () => {
                              refresh();
                              toast.success("Case reopened");
                            },
                            onError: (error) => toast.error(error.message),
                          }
                        )
                      }
                    >
                      <RotateCcw />
                      Reopen
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void onRemove()}>
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {confirmDialog}
    </>
  );
}

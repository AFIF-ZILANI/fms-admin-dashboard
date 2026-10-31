import { useState } from "react";
import { CalendarClock, Pencil, Plus, Syringe, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { NumericInput } from "@/components/utils/NumaricInput";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useDelete, useGetData, usePatchData, usePostData } from "@/lib/api";
import { formatDate, humanizeEnum } from "@/lib/utils";
import { cycleDay, dayStart } from "@/pages/batches/cycle-day";
import type { Batch, BatchVaccineSchedule, VaccineTemplate } from "@/pages/batches/types";
import { useVaccineItems } from "@/pages/batches/use-vaccine-items";

/** Due/overdue are derived, never stored: only PENDING moves with the calendar. */
function rowState(row: BatchVaccineSchedule, today: number): { tone: Tone; label: string } {
  if (row.status === "DONE") return { tone: "success", label: "Done" };
  if (row.status === "CANCELLED") return { tone: "neutral", label: "Cancelled" };
  if (row.day === today) return { tone: "info", label: "Due today" };
  if (row.day < today) return { tone: "critical", label: "Overdue" };
  return { tone: "neutral", label: "Upcoming" };
}

type RowBody = { day: number; item_id: string; purpose: string; method?: string };

function RowDialog({ batch, row, onClose }: { batch: Batch; row?: BatchVaccineSchedule; onClose: () => void }) {
  const [day, setDay] = useState(row ? String(row.day) : "");
  const [itemId, setItemId] = useState(row?.item_id ?? "");
  const [purpose, setPurpose] = useState(row?.purpose ?? "");
  const [method, setMethod] = useState(row?.method ?? "");
  // React Compiler: read optional fields into locals before closures use them (see the SelectValue below).
  const currentName = row?.item.name;
  const vaccines = useVaccineItems();
  const key = ["batch-vaccine-schedules", batch.id];
  const create = usePostData<BatchVaccineSchedule, RowBody & { batch_id: string }>("/batch-vaccine-schedules", key);
  const update = usePatchData<BatchVaccineSchedule, RowBody>(`/batch-vaccine-schedules/${row?.id}`, key);

  const submit = () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1) return toast.error("Day must be 1 or later");
    if (!itemId) return toast.error("Select a vaccine");
    if (!purpose.trim()) return toast.error("Purpose is required");
    const body = { day: n, item_id: itemId, purpose: purpose.trim(), ...(method.trim() && { method: method.trim() }) };
    const done = {
      onSuccess: () => {
        toast.success(row ? "Vaccine updated" : "Vaccine added");
        onClose();
      },
      onError: (error: Error) => toast.error(error.message),
    };
    return row ? update.mutate(body, done) : create.mutate({ ...body, batch_id: batch.id }, done);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? "Edit vaccine" : "Add vaccine"}</DialogTitle>
          {row && (
            <DialogDescription>
              Fixing a mistake. To give it on a different day, use Reschedule instead so the planned day is kept.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid grid-cols-[5rem_1fr] gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vax-day">Day</Label>
            <NumericInput id="vax-day" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Vaccine</Label>
            <Select value={itemId} onValueChange={(v) => setItemId(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: string) => vaccines.find((i) => i.id === v)?.name ?? currentName ?? "Select vaccine"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vaccines.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vax-purpose">Purpose</Label>
          <Input id="vax-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Newcastle + IB" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vax-method">Method (optional)</Label>
          <Input id="vax-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Eye drop" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            {row ? "Save" : "Add vaccine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reschedule (new day + reason) or cancel (reason only). */
function ReasonDialog({
  row,
  mode,
  onClose,
}: {
  row: BatchVaccineSchedule;
  mode: "reschedule" | "cancel";
  onClose: () => void;
}) {
  const [day, setDay] = useState(String(row.day));
  const [reason, setReason] = useState("");
  const action = usePostData<BatchVaccineSchedule, { day?: number; reason: string }>(
    `/batch-vaccine-schedules/${row.id}/${mode}`,
    ["batch-vaccine-schedules", row.batch_id]
  );

  const submit = () => {
    const n = Number(day);
    if (mode === "reschedule" && (!Number.isInteger(n) || n < 1)) return toast.error("Day must be 1 or later");
    if (!reason.trim()) return toast.error("Give a reason");
    return action.mutate(mode === "reschedule" ? { day: n, reason: reason.trim() } : { reason: reason.trim() }, {
      onSuccess: () => {
        toast.success(mode === "reschedule" ? "Vaccine rescheduled" : "Vaccine cancelled");
        onClose();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "reschedule" ? "Reschedule vaccine" : "Cancel vaccine"}</DialogTitle>
          <DialogDescription>
            {row.item.name} · {row.purpose} · planned Day {row.planned_day}
            {mode === "reschedule" && ". Moving it to today lets the worker confirm it early."}
          </DialogDescription>
        </DialogHeader>
        {mode === "reschedule" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vax-new-day">New day</Label>
            <NumericInput id="vax-new-day" value={day} onChange={(e) => setDay(e.target.value)} autoFocus />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vax-reason">Reason</Label>
          <Input
            id="vax-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === "reschedule" ? "Birds stressed after transfer" : "Vet advised to skip"}
            autoFocus={mode === "cancel"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant={mode === "cancel" ? "destructive" : "default"} onClick={submit} disabled={action.isPending}>
            {mode === "reschedule" ? "Reschedule" : "Cancel vaccine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplate({ batch }: { batch: Batch }) {
  const [templateId, setTemplateId] = useState("");
  const { data: templates } = useGetData<VaccineTemplate[]>("/vaccine-templates?active=true", ["vaccine-templates", "active"]);
  const apply = usePostData<BatchVaccineSchedule[], { batch_id: string; template_id: string }>(
    "/batch-vaccine-schedules/apply",
    ["batch-vaccine-schedules", batch.id]
  );
  const list = templates ?? [];

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
      <Select value={templateId} onValueChange={(v) => setTemplateId(String(v))}>
        <SelectTrigger className="w-full">
          <SelectValue>{(v: string) => list.find((t) => t.id === v)?.name ?? "Choose a template"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {list.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name} ({t.entries.length})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        disabled={!templateId || apply.isPending}
        onClick={() =>
          apply.mutate(
            { batch_id: batch.id, template_id: templateId },
            { onSuccess: () => toast.success("Schedule added"), onError: (error) => toast.error(error.message) }
          )
        }
      >
        <Plus />
        Add schedule
      </Button>
    </div>
  );
}

type Open = { kind: "add" } | { kind: "edit" | "reschedule" | "cancel"; row: BatchVaccineSchedule } | undefined;

export function VaccineTab({ batch }: { batch: Batch }) {
  const [open, setOpen] = useState<Open>(undefined);
  const { confirm, confirmDialog } = useConfirm();
  const { data: rows, isLoading } = useGetData<BatchVaccineSchedule[]>(
    `/batch-vaccine-schedules?batch_id=${batch.id}`,
    ["batch-vaccine-schedules", batch.id]
  );
  const remove = useDelete<null, string>((id) => `/batch-vaccine-schedules/${id}`, ["batch-vaccine-schedules", batch.id]);
  const today = cycleDay(batch.starting_date);
  const running = batch.status === "RUNNING";

  const removeRow = async (row: BatchVaccineSchedule) => {
    const ok = await confirm({
      title: "Remove this vaccine?",
      description: "Only for a row added by mistake. If the vaccine was skipped, cancel it instead so the reason is kept.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) remove.mutate(row.id, { onError: (error) => toast.error(error.message) });
  };

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );

  const list = rows ?? [];
  // The "today" line sits before the first row that's still ahead.
  const todayIndex = list.findIndex((r) => r.day > today);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        title="Vaccine schedule"
        description={`Today is Day ${today}. Workers confirm each vaccine on the farm app by scanning the bottles used.`}
      >
        {list.length > 0 && (
          <Button size="sm" onClick={() => setOpen({ kind: "add" })}>
            <Plus />
            Add vaccine
          </Button>
        )}
      </SectionHeader>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-full">
            <EmptyState
              icon={Syringe}
              title="No vaccine schedule"
              description="Pick a template to lay out this batch's vaccines, or add them one by one."
            />
          </div>
          <ApplyTemplate batch={batch} />
          <Button variant="link" size="sm" onClick={() => setOpen({ kind: "add" })}>
            Add a single vaccine instead
          </Button>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {list.map((row, i) => {
            const state = rowState(row, today);
            const pending = row.status === "PENDING";
            return (
              <li key={row.id} className="flex flex-col gap-2">
                {i === todayIndex && <TodayLine day={today} />}
                <Card className={row.status === "CANCELLED" ? "opacity-60" : undefined}>
                  <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                    <div className="w-28 shrink-0">
                      <p className="text-sm font-semibold tabular-nums">Day {row.day}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(dayStart(batch.starting_date, row.day).toISOString())}</p>
                      {row.day !== row.planned_day && (
                        <p className="text-xs text-muted-foreground">planned Day {row.planned_day}</p>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={row.status === "CANCELLED" ? "font-medium line-through" : "font-medium"}>
                          {row.item.name}
                        </span>
                        <StatusBadge tone={state.tone} label={state.label} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {row.purpose}
                        {row.method && ` · ${row.method}`}
                      </p>
                      {row.reason && (
                        <p className="text-xs text-muted-foreground">
                          {row.status === "CANCELLED" ? "Cancelled" : "Rescheduled"}: {row.reason}
                        </p>
                      )}
                      {row.status === "DONE" && (
                        <p className="text-xs text-muted-foreground">
                          {row.confirmed_by?.name ?? "Someone"} confirmed {row.confirmed_at ? formatDate(row.confirmed_at) : ""} ·{" "}
                          {row.vaccinations
                            .map((v) =>
                              v.consumption
                                ? `${Number(v.consumption.quantity)} ${humanizeEnum(v.consumption.unit)} (…${v.consumption.stock_unit_id?.slice(-7)}, ${v.consumption.house.name})`
                                : `${Number(v.dosage)}`
                            )
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    {pending && running && (
                      <div className="flex flex-wrap gap-1 sm:justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setOpen({ kind: "reschedule", row })}>
                          <CalendarClock />
                          Reschedule
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setOpen({ kind: "cancel", row })}>
                          <XCircle />
                          Cancel
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setOpen({ kind: "edit", row })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => removeRow(row)}>
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
          {todayIndex === -1 && <TodayLine day={today} />}
        </ol>
      )}

      {open?.kind === "add" && <RowDialog batch={batch} onClose={() => setOpen(undefined)} />}
      {open?.kind === "edit" && <RowDialog batch={batch} row={open.row} onClose={() => setOpen(undefined)} />}
      {(open?.kind === "reschedule" || open?.kind === "cancel") && (
        <ReasonDialog row={open.row} mode={open.kind} onClose={() => setOpen(undefined)} />
      )}
      {confirmDialog}
    </div>
  );
}

function TodayLine({ day }: { day: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-primary">
      <span className="h-px flex-1 bg-primary/40" />
      Today · Day {day}
      <span className="h-px flex-1 bg-primary/40" />
    </div>
  );
}

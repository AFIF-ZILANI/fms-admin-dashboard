import { useState } from "react";
import { Plus, Wheat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, usePatchData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Batch, BatchFeedingProgram, Consumption } from "@/pages/batches/types";
import type { Item } from "@/pages/inventory/types";
import { FeedingProgramFormDialog } from "@/pages/batches/tabs/feeding-program-form-dialog";

function daysFromStart(startingDate: string, dayOffset: number): Date {
  const d = new Date(startingDate);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d;
}

function EndProgramDialog({
  row,
  onOpenChange,
}: {
  row: BatchFeedingProgram;
  onOpenChange: (open: boolean) => void;
}) {
  const [endDay, setEndDay] = useState(String(row.start_day));
  const updateProgram = usePatchData<BatchFeedingProgram, { end_day: number }>(
    `/batch-feeding-programs/${row.id}`,
    ["batch-feeding-programs", row.batch_id]
  );

  const submit = () => {
    const value = Number(endDay);
    if (!Number.isInteger(value) || value < 0) {
      toast.error("End day must be a whole number, 0 or more");
      return;
    }
    updateProgram.mutate(
      { end_day: value },
      {
        onSuccess: () => {
          toast.success("End day set");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Set end day</DialogTitle>
        </DialogHeader>
        <Input type="number" value={endDay} onChange={(e) => setEndDay(e.target.value)} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={updateProgram.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FeedingProgramTab({ batch }: { batch: Batch }) {
  const [formOpen, setFormOpen] = useState(false);
  const [endingRow, setEndingRow] = useState<BatchFeedingProgram | undefined>(undefined);

  const { data, isLoading } = useGetData<Paginated<BatchFeedingProgram>>(
    `/batch-feeding-programs?batch_id=${batch.id}&limit=100`,
    ["batch-feeding-programs", batch.id]
  );
  const { data: feedItems } = useGetData<Paginated<Item>>("/items?category=FEED&limit=100", ["items", "FEED"]);
  const itemName = (id: string) => feedItems?.results.find((i) => i.id === id)?.name ?? id;

  const { data: consumptions } = useGetData<Paginated<Consumption>>(
    `/consumptions?batch_id=${batch.id}&limit=100`,
    ["consumptions", batch.id]
  );

  const actualConsumed = (program: BatchFeedingProgram): number => {
    const windowStart = daysFromStart(batch.starting_date, program.start_day);
    const windowEnd = program.end_day != null ? daysFromStart(batch.starting_date, program.end_day + 1) : new Date();
    return (consumptions?.results ?? [])
      .filter((c) => c.item_id === program.item_id)
      .filter((c) => {
        const d = new Date(c.date);
        return d >= windowStart && d < windowEnd;
      })
      .reduce((sum, c) => sum + parseFloat(c.quantity), 0);
  };

  const columns: Column<BatchFeedingProgram>[] = [
    { key: "feed_type", header: "Feed type", render: (p) => humanizeEnum(p.feed_type) },
    { key: "item", header: "Item", render: (p) => itemName(p.item_id) },
    { key: "start", header: "Start day", render: (p) => p.start_day, numeric: true },
    { key: "end", header: "End day", render: (p) => p.end_day ?? "—", numeric: true },
    {
      key: "actual",
      header: "Actual consumed",
      render: (p) => {
        const item = feedItems?.results.find((i) => i.id === p.item_id);
        return `${actualConsumed(p).toLocaleString()} ${item ? humanizeEnum(item.unit) : ""}`.trim();
      },
      numeric: true,
    },
    {
      key: "actions",
      header: "",
      render: (p) =>
        p.end_day == null ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEndingRow(p)}>
              End
            </Button>
          </div>
        ) : null,
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus />
          Add row
        </Button>
      </div>

      {consumptions && consumptions.total > consumptions.results.length && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {consumptions.results.length} of {consumptions.total} consumption records — "Actual
          consumed" may undercount early-cycle rows.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={(data?.results ?? []).sort((a, b) => a.start_day - b.start_day)}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        empty={{ icon: Wheat, title: "No feeding program defined for this batch yet" }}
      />

      <FeedingProgramFormDialog open={formOpen} onOpenChange={setFormOpen} batchId={batch.id} />
      {endingRow && <EndProgramDialog row={endingRow} onOpenChange={() => setEndingRow(undefined)} />}
    </div>
  );
}

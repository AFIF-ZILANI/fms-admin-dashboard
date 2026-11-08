import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useGetData, usePostData } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";

const DAY = 86_400_000;

/** A SOLD batch's settlement window: when it locks on its own, and a button to lock it now. */
export function FinalizeBatch({ batch }: { batch: Batch }) {
  const settings = useGetData<{ settlement_days: number }>("/farm-settings", ["farm-settings"]);
  const finalize = usePostData<Batch, void>(`/batches/${batch.id}/finalize`, ["batches"]);
  const { confirm, confirmDialog } = useConfirm();
  const endedAt = batch.actual_end_date;
  const days = settings.data?.settlement_days;
  const until = endedAt && days !== undefined ? new Date(new Date(endedAt).getTime() + days * DAY) : null;

  const onFinalize = async () => {
    const ok = await confirm({
      title: `Finalise ${batch.batch_code}?`,
      description:
        "Its books become final: no more costs, usage or sales can be added to this batch. Equipment depreciation is charged now.",
      confirmLabel: "Finalise",
    });
    if (!ok) return;
    finalize.mutate(undefined, {
      onSuccess: () => toast.success("Batch finalised"),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <>
      {until && <span className="text-sm text-muted-foreground">Open for late entries until {formatDate(until.toISOString())}</span>}
      <Button variant="outline" size="sm" onClick={onFinalize} disabled={finalize.isPending}>
        Finalise now
      </Button>
      {confirmDialog}
    </>
  );
}

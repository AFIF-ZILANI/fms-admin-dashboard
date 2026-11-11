import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatchData } from "@/lib/api";
import { farmToday } from "@/lib/farm-day";
import { formatDate } from "@/lib/utils";
import { casesForLog } from "@/pages/batches/disease-cases";
import type { DiseaseCase, MortalityLog } from "@/pages/batches/types";

const NONE = "none";

/** Fix a death logged without its outbreak (or linked to the wrong one). */
export function MortalityDiseaseDialog({
  log,
  cases,
  onOpenChange,
}: {
  log: MortalityLog | null;
  cases: DiseaseCase[];
  onOpenChange: (open: boolean) => void;
}) {
  // Plain locals: the React Compiler memoizes optional reads in closures on the non-optional path.
  const logId = log?.id ?? "";
  const batchId = log?.batch_id ?? "";
  const current = log?.disease_case_id ?? "";
  const [value, setValue] = useState(current); // the parent keys this dialog by log, so it starts fresh per log

  const options = log ? casesForLog(cases, log) : [];
  const label = (id: string) => {
    const c = cases.find((x) => x.id === id); // all cases: a current link may fall outside the window
    return c ? `${c.disease.label} · since ${formatDate(c.noticed_on)}` : "None";
  };

  const queryClient = useQueryClient();
  const save = usePatchData<MortalityLog, { disease_case_id: string | null }>(`/mortality-logs/${logId}`, [
    "mortality-logs",
    batchId,
  ]);

  const onSave = () =>
    save.mutate(
      { disease_case_id: value || null },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["disease-cases"] }); // case death totals move
          toast.success(value ? "Disease linked" : "Disease unlinked");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Dialog open={!!log} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disease for this death</DialogTitle>
          <DialogDescription>
            {log
              ? `${log.count_died} died on ${farmToday(new Date(log.date))}. Only cases active that day in this house are listed.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fix_disease_case_id">Disease</Label>
          <Select value={value || NONE} onValueChange={(v) => setValue(!v || v === NONE ? "" : v)}>
            <SelectTrigger id="fix_disease_case_id" className="w-full">
              <SelectValue>{(v: string) => (v === NONE ? "None" : label(v))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {label(c.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!options.length && (
            <p className="text-sm text-muted-foreground">No disease case was active in this house that day.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={save.isPending || value === current}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

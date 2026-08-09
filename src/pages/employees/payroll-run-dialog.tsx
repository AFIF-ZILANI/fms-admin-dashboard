import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import {
  PAYROLL_CLAMP_MAX,
  PAYROLL_CLAMP_MIN,
  type PayrollRecord,
  type PerformanceScoreEntry,
} from "@/pages/employees/types";

type PayrollRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  baselineSalary: string;
  scoreEntries: PerformanceScoreEntry[];
};

export function PayrollRunDialog({ open, onOpenChange, employeeId, baselineSalary, scoreEntries }: PayrollRunDialogProps) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  // Reset to the current month on each open, without an effect (React docs'
  // "adjusting state during render" pattern) — dialog stays mounted between
  // opens, so a plain default only would leak the previous selection.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMonth(new Date().toISOString().slice(0, 7));
  }

  const generatePayroll = usePostData<PayrollRecord, { employee_id: string; month: string }>(
    "/payroll-records/generate",
    ["payroll-records"]
  );

  // Preview only — mirrors payroll-record.service.ts's generate() formula
  // exactly (sum this month's points, clamp to [-10, +20], apply to
  // baseline). The server recomputes and locks it; this is just so the
  // confirm button doesn't fire blind on an immutable write.
  const [year, monthNum] = month.split("-").map(Number) as [number, number];
  const scoreSum = scoreEntries
    .filter((e) => {
      const d = new Date(e.date);
      return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === monthNum;
    })
    .reduce((sum, e) => sum + e.points, 0);
  const adjustmentPercent = Math.max(PAYROLL_CLAMP_MIN, Math.min(PAYROLL_CLAMP_MAX, scoreSum));
  const finalSalary = parseFloat(baselineSalary) * (1 + adjustmentPercent / 100);

  const onConfirm = () => {
    generatePayroll.mutate(
      { employee_id: employeeId, month: `${month}-01` },
      {
        onSuccess: () => {
          toast.success("Payroll generated");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Run payroll</DialogTitle>
          <DialogDescription>
            This locks a permanent record for the month — it can't be edited or regenerated afterward.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payroll-month">Month</Label>
            <Input id="payroll-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Baseline salary</span>
              <span className="tabular-nums">{formatMoney(baselineSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Score sum (this month)</span>
              <span className="tabular-nums">{scoreSum}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adjustment (clamped)</span>
              <span className="tabular-nums">
                {adjustmentPercent > 0 ? "+" : ""}
                {adjustmentPercent}%
              </span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Final salary</span>
              <span className="tabular-nums">{formatMoney(finalSalary)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={generatePayroll.isPending}>
            Confirm &amp; lock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

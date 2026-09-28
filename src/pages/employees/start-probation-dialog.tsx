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
import { usePatchData } from "@/lib/api";
import type { Employee } from "@/pages/employees/types";

/** Three months on from today, the usual probation length — a default, not a rule. */
function defaultEnd() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function StartProbationDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}) {
  const [endDate, setEndDate] = useState(defaultEnd);

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setEndDate(employee.probation_end_date?.slice(0, 10) ?? defaultEnd());
  }

  const update = usePatchData<Employee, { employment_status: string; probation_end_date: string }>(
    () => `/employees/${employee.id}`,
    ["employees"]
  );

  const onConfirm = () => {
    update.mutate(
      { employment_status: "PROBATION", probation_end_date: endDate },
      {
        onSuccess: () => {
          toast.success(`${employee.profile.name} is on probation`);
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
          <DialogTitle>Start probation</DialogTitle>
          <DialogDescription>
            The end date is what the reminder watches — you'll be warned a week before it, and
            again if it passes without a decision.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="probation_end">Probation ends</Label>
          <Input
            id="probation_end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={update.isPending || !endDate}>
            Start probation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

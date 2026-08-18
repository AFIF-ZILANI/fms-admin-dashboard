import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActorSelect } from "@/components/shared/actor-select";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import { COST_TYPES, type Expense } from "@/pages/finance/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

const expenseSchema = z.object({
  batch_id: z.string().optional(),
  category: z.string().min(1, "Select a category"),
  cost_type: z.enum(COST_TYPES, "Select a cost type"),
  amount: z.coerce.number().positive("Must be positive"),
  date: z.string().min(1, "Date is required"),
  remarks: z.string().trim().optional(),
  recorded_by_id: z.string().min(1, "Select who's recording this"),
});

type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseFormValues = z.output<typeof expenseSchema>;

function blankExpense(): ExpenseFormInput {
  return {
    batch_id: "",
    category: undefined as unknown as ExpenseFormInput["category"],
    cost_type: undefined as unknown as ExpenseFormInput["cost_type"],
    amount: undefined,
    date: new Date().toISOString().slice(0, 10),
    remarks: "",
    recorded_by_id: "",
  };
}

type ExpenseCreateDialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function ExpenseCreateDialog({ open, onOpenChange }: ExpenseCreateDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: blankExpense(),
  });

  useEffect(() => {
    if (open) reset(blankExpense());
  }, [open, reset]);

  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: categories } = useGetData<Paginated<LookupRow>>(
    "/expense-categories?active=true&limit=100",
    ["expense-categories", "active"]
  );
  const createExpense = usePostData<Expense, ExpenseFormValues>("/expenses", ["expenses"]);

  const onSubmit = (values: ExpenseFormValues) => {
    const payload = {
      ...values,
      batch_id: values.batch_id || undefined,
      remarks: values.remarks || undefined,
    };
    createExpense.mutate(payload, {
      onSuccess: () => {
        toast.success("Expense recorded");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.fieldError("amount") ?? error.fieldError("recorded_by_id") ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            Direct expenses count against a batch's P&L; shared-period costs stay unallocated until the v2
            bird-days formula ships.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                      <SelectValue>
                        {(v: string) =>
                          v ? (categories?.results.find((c) => c.code === v)?.label ?? humanizeEnum(v)) : "Select category"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(categories?.results ?? []).map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost_type">Cost type</Label>
              <Controller
                control={control}
                name="cost_type"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="cost_type" className="w-full" aria-invalid={!!errors.cost_type}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select cost type")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COST_TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {humanizeEnum(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.cost_type && <p className="text-xs text-destructive">{errors.cost_type.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} aria-invalid={!!errors.amount} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch_id">Batch (optional)</Label>
            <Controller
              control={control}
              name="batch_id"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="batch_id" className="w-full">
                    <SelectValue>
                      {(v: string) => batches?.results.find((b) => b.id === v)?.batch_code ?? "None (farm-wide)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(batches?.results ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks (optional)</Label>
            <Input id="remarks" {...register("remarks")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recorded_by_id">Recorded by</Label>
            <Controller
              control={control}
              name="recorded_by_id"
              render={({ field }) => (
                <ActorSelect
                  id="recorded_by_id"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  invalid={!!errors.recorded_by_id}
                />
              )}
            />
            {errors.recorded_by_id && <p className="text-xs text-destructive">{errors.recorded_by_id.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Record expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

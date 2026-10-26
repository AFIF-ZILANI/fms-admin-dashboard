import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { FarmAccountSelect } from "@/components/shared/farm-account-select";
import type { Batch } from "@/pages/batches/types";
import { COST_TYPES, type Expense } from "@/pages/finance/types";
import type { LookupRow } from "@/pages/settings/lookup-types";

/** Wage and fee expenses are paid by their payroll payout, never here (the server refuses it too). */
const PAYROLL_CATEGORIES = ["SALARY", "FESTIVAL_BONUS", "SALARY_TRANSFER_FEE"];

const PAYMENT_OPTIONS = { FULL: "Paid in full", PARTIAL: "Partly paid", UNPAID: "Not paid yet" } as const;
type ExpensePayment = keyof typeof PAYMENT_OPTIONS;

const expenseSchema = z
  .object({
    batch_id: z.string().optional(),
    category: z.string().min(1, "Select a category"),
    cost_type: z.enum(COST_TYPES, "Select a cost type"),
    amount: z.coerce.number().positive("Must be positive"),
    date: z.string().min(1, "Date is required"),
    remarks: z.string().trim().optional(),
    payment: z.enum(["FULL", "PARTIAL", "UNPAID"]),
    partial_amount: z.string().optional(),
    paid_from_instrument_id: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    // Mirrors the server (and the Expense_direct_has_batch CHECK): a DIRECT cost is charged to a batch.
    if (d.cost_type === "DIRECT" && !d.batch_id)
      ctx.addIssue({ code: "custom", path: ["batch_id"], message: "A direct cost needs a batch" });
    if (PAYROLL_CATEGORIES.includes(d.category) || d.payment === "UNPAID") return;
    if (d.payment === "PARTIAL") {
      const paid = Number(d.partial_amount);
      if (!(paid > 0)) ctx.addIssue({ code: "custom", path: ["partial_amount"], message: "Enter how much was paid" });
      else if (paid >= d.amount)
        ctx.addIssue({ code: "custom", path: ["partial_amount"], message: "That covers it all -- choose Paid in full" });
    }
    if (!d.paid_from_instrument_id)
      ctx.addIssue({ code: "custom", path: ["paid_from_instrument_id"], message: "Choose the account it was paid from" });
  });

type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseFormValues = z.output<typeof expenseSchema>;

function blankExpense(): ExpenseFormInput {
  return {
    batch_id: "",
    category: "",
    cost_type: undefined as unknown as ExpenseFormInput["cost_type"],
    amount: undefined,
    date: new Date().toISOString().slice(0, 10),
    remarks: "",
    // Most farm expenses are settled on the spot -- recorded and paid in one go.
    payment: "FULL",
    partial_amount: "",
    paid_from_instrument_id: "",
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
  const createExpense = usePostData<Expense, Record<string, unknown>>("/expenses", ["expenses"]);
  const queryClient = useQueryClient();
  const category = useWatch({ control, name: "category" });
  const payment = useWatch({ control, name: "payment" });
  const costType = useWatch({ control, name: "cost_type" });
  const amount = Number(useWatch({ control, name: "amount" })) || 0;
  const partial = Number(useWatch({ control, name: "partial_amount" })) || 0;
  const paidByPayroll = PAYROLL_CATEGORIES.includes(category);

  const onSubmit = (values: ExpenseFormValues) => {
    const paid = paidByPayroll || values.payment === "UNPAID" ? 0 : values.payment === "FULL" ? values.amount : Number(values.partial_amount);
    const payload = {
      batch_id: values.batch_id || undefined,
      category: values.category,
      cost_type: values.cost_type,
      amount: values.amount,
      date: values.date,
      remarks: values.remarks || undefined,
      paid_amount: paid,
      paid_from_instrument_id: paid > 0 ? values.paid_from_instrument_id : undefined,
    };
    return createExpense.mutate(payload, {
      onSuccess: () => {
        // A paid expense moves an account balance and the dashboard's cash and payables.
        for (const key of ["payments", "payment-instruments", "analytics"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        toast.success(paid > 0 ? `Expense recorded and ${formatMoney(paid)} paid` : "Expense recorded as unpaid");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.fieldError("amount") ?? error.fieldError("paid_from_instrument_id") ?? error.message);
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
            <Label htmlFor="batch_id">{costType === "DIRECT" ? "Batch" : "Batch (optional)"}</Label>
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
            {errors.batch_id && <p className="text-xs text-destructive">{errors.batch_id.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks (optional)</Label>
            <Input id="remarks" {...register("remarks")} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            {paidByPayroll ? (
              <p className="text-sm text-muted-foreground">
                Salary and bonus costs are paid through their payroll payout, not here.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="payment">Payment</Label>
                  <Controller
                    control={control}
                    name="payment"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "FULL")}>
                        <SelectTrigger id="payment" className="w-full">
                          <SelectValue>{(v: ExpensePayment) => PAYMENT_OPTIONS[v]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PAYMENT_OPTIONS) as ExpensePayment[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              {PAYMENT_OPTIONS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {payment !== "UNPAID" && (
                  <div className="grid grid-cols-2 gap-4">
                    {payment === "PARTIAL" ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="partial_amount">Amount paid</Label>
                        <Input
                          id="partial_amount"
                          type="number"
                          step="0.01"
                          {...register("partial_amount")}
                          aria-invalid={!!errors.partial_amount}
                        />
                        {errors.partial_amount ? (
                          <p className="text-xs text-destructive">{errors.partial_amount.message}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Still to pay: {formatMoney(Math.max(0, amount - partial))}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <Label>Amount paid</Label>
                        <p className="flex h-8 items-center text-sm font-medium tabular-nums">{formatMoney(amount)}</p>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="paid_from_instrument_id">Paid from</Label>
                      <Controller
                        control={control}
                        name="paid_from_instrument_id"
                        render={({ field }) => (
                          <FarmAccountSelect
                            id="paid_from_instrument_id"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            invalid={!!errors.paid_from_instrument_id}
                          />
                        )}
                      />
                      {errors.paid_from_instrument_id && (
                        <p className="text-xs text-destructive">{errors.paid_from_instrument_id.message}</p>
                      )}
                    </div>
                  </div>
                )}
                {payment === "UNPAID" && (
                  <p className="text-xs text-muted-foreground">
                    It will show as owed until you record its payment on the Payments page.
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Record expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
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
import { usePostData } from "@/lib/api";
import {
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  type EmployeePayoutAccount,
  type PayoutMethod,
} from "@/pages/employees/types";

const accountSchema = z
  .object({
    method: z.enum(PAYOUT_METHODS, "Select a method"),
    account_name: z.string().trim().min(1, "Account name is required"),
    account_number: z.string().trim().min(1, "Account number is required"),
    bank_name: z.string().trim().optional(),
    branch_name: z.string().trim().optional(),
    routing_number: z.string().trim().optional(),
    holder_relation: z.string().trim().optional(),
    consent_doc_url: z.string().trim().optional(),
  })
  .refine((d) => d.method !== "BANK" || !!d.bank_name?.trim(), {
    message: "Bank name is required for a bank account",
    path: ["bank_name"],
  })
  .refine((d) => !d.routing_number || /^\d{9}$/.test(d.routing_number), {
    message: "Routing number must be 9 digits",
    path: ["routing_number"],
  })
  .refine((d) => !d.holder_relation?.trim() || !!d.consent_doc_url?.trim(), {
    message: "A third-party account needs the holder's signed consent on file",
    path: ["consent_doc_url"],
  });

type AccountFormValues = z.output<typeof accountSchema>;

type PayoutAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  /** The account this one replaces, if any — shown so the change is deliberate. */
  replacing: EmployeePayoutAccount | null;
};

export function PayoutAccountDialog({
  open,
  onOpenChange,
  employeeId,
  replacing,
}: PayoutAccountDialogProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues, unknown, AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { method: undefined as unknown as PayoutMethod, account_name: "", account_number: "" },
  });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) reset({ method: undefined as unknown as PayoutMethod, account_name: "", account_number: "" });
  }

  const method = useWatch({ control, name: "method" });
  const isThirdParty = !!useWatch({ control, name: "holder_relation" })?.trim();

  const createAccount = usePostData<EmployeePayoutAccount, AccountFormValues & { employee_id: string }>(
    "/employee-payout-accounts",
    ["employee-payout-accounts"]
  );

  const onSubmit = (values: AccountFormValues) => {
    const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
    createAccount.mutate(
      {
        ...values,
        employee_id: employeeId,
        bank_name: blank(values.bank_name),
        branch_name: blank(values.branch_name),
        routing_number: blank(values.routing_number),
        holder_relation: blank(values.holder_relation),
        consent_doc_url: blank(values.consent_doc_url),
      },
      {
        onSuccess: () => {
          toast.success(replacing ? "Account replaced" : "Payout account added");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.fieldError("consent_doc_url") ?? error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{replacing ? "Replace payout account" : "Add payout account"}</DialogTitle>
          <DialogDescription>
            {replacing
              ? `This closes ${replacing.account_number} and opens a new one — the old account stays on record. Keep the employee's signed change request on file.`
              : "Where this employee's wage is sent."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Method</Label>
              <Controller
                control={control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="method" className="w-full" aria-invalid={!!errors.method}>
                      <SelectValue>
                        {(v: string) => (v ? PAYOUT_METHOD_LABELS[v as PayoutMethod] : "Select method")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PAYOUT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYOUT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.method && <p className="text-xs text-destructive">{errors.method.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account_number">Account / wallet number</Label>
              <Input id="account_number" {...register("account_number")} aria-invalid={!!errors.account_number} />
              {errors.account_number && (
                <p className="text-xs text-destructive">{errors.account_number.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account_name">Name on the account</Label>
            <Input id="account_name" {...register("account_name")} aria-invalid={!!errors.account_name} />
            {errors.account_name && <p className="text-xs text-destructive">{errors.account_name.message}</p>}
          </div>

          {method === "BANK" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_name">Bank</Label>
                <Input id="bank_name" {...register("bank_name")} aria-invalid={!!errors.bank_name} />
                {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch_name">Branch</Label>
                <Input id="branch_name" {...register("branch_name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="routing_number">Routing</Label>
                <Input id="routing_number" placeholder="9 digits" {...register("routing_number")} />
                {errors.routing_number && (
                  <p className="text-xs text-destructive">{errors.routing_number.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="holder_relation">
              Holder relation
              <span className="ml-1 font-normal text-muted-foreground">(if not their own)</span>
            </Label>
            <Input id="holder_relation" placeholder="spouse, father…" {...register("holder_relation")} />
          </div>

          {isThirdParty && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="consent_doc_url">Holder's signed consent</Label>
              <Input
                id="consent_doc_url"
                placeholder="Link to the signed consent"
                {...register("consent_doc_url")}
                aria-invalid={!!errors.consent_doc_url}
              />
              {errors.consent_doc_url ? (
                <p className="text-xs text-destructive">{errors.consent_doc_url.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Wages paid into someone else's account need that person's written consent.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {replacing ? "Replace account" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

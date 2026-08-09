import { useEffect } from "react";
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
import { usePatchData, usePostData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import {
  MFS_TYPES,
  OWNER_TYPES,
  PAYMENT_METHODS,
  type PaymentInstrument,
} from "@/pages/payments/types";

const instrumentSchema = z.object({
  owner_type: z.enum(OWNER_TYPES, "Select an owner type"),
  owner_id: z.string().uuid("A valid owner id is required"),
  type: z.enum(PAYMENT_METHODS, "Select a payment method"),
  label: z.string().min(1, "Label is required"),
  bank_name: z.string().trim().optional(),
  account_no: z.string().trim().optional(),
  mobile_no: z.string().trim().optional(),
  mfs_type: z.enum(MFS_TYPES).optional(),
});

type InstrumentFormValues = z.infer<typeof instrumentSchema>;

function blankInstrument(): InstrumentFormValues {
  return {
    owner_type: "ADMIN",
    owner_id: "",
    type: undefined as unknown as InstrumentFormValues["type"],
    label: "",
    bank_name: "",
    account_no: "",
    mobile_no: "",
    mfs_type: undefined,
  };
}

function toFormValues(instrument: PaymentInstrument): InstrumentFormValues {
  return {
    owner_type: instrument.owner_type,
    owner_id: instrument.owner_id,
    type: instrument.type,
    label: instrument.label,
    bank_name: instrument.bank_name ?? "",
    account_no: instrument.account_no ?? "",
    mobile_no: instrument.mobile_no ?? "",
    mfs_type: instrument.mfs_type ?? undefined,
  };
}

type InstrumentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrument?: PaymentInstrument;
};

export function InstrumentFormDialog({ open, onOpenChange, instrument }: InstrumentFormDialogProps) {
  const isEdit = !!instrument;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InstrumentFormValues>({
    resolver: zodResolver(instrumentSchema),
    defaultValues: blankInstrument(),
  });

  useEffect(() => {
    if (open) reset(instrument ? toFormValues(instrument) : blankInstrument());
  }, [open, instrument, reset]);

  const type = useWatch({ control, name: "type" });

  const createInstrument = usePostData<PaymentInstrument, InstrumentFormValues>("/payment-instruments", [
    "payment-instruments",
  ]);
  const updateInstrument = usePatchData<PaymentInstrument, InstrumentFormValues>(
    () => `/payment-instruments/${instrument?.id}`,
    ["payment-instruments"]
  );

  const onSubmit = (values: InstrumentFormValues) => {
    const payload = {
      ...values,
      bank_name: values.bank_name || undefined,
      account_no: values.account_no || undefined,
      mobile_no: values.mobile_no || undefined,
      mfs_type: values.mfs_type || undefined,
    };
    const mutation = isEdit ? updateInstrument : createInstrument;
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Instrument updated" : "Instrument created");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.fieldError("label") ?? error.fieldError("owner_id") ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit instrument" : "Add payment instrument"}</DialogTitle>
          <DialogDescription>
            An instrument is a cash box, bank account, or mobile wallet that payments flow through.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" {...register("label")} aria-invalid={!!errors.label} />
            {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner_type">Owner type</Label>
              <Controller
                control={control}
                name="owner_type"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={isEdit}>
                    <SelectTrigger id="owner_type" className="w-full">
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {OWNER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {humanizeEnum(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner_id">Owner id</Label>
              <Input
                id="owner_id"
                placeholder="UUID of the owning record"
                disabled={isEdit}
                {...register("owner_id")}
                aria-invalid={!!errors.owner_id}
              />
              {errors.owner_id && <p className="text-xs text-destructive">{errors.owner_id.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="type" className="w-full" aria-invalid={!!errors.type}>
                    <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select type")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {humanizeEnum(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          {type === "BANK_TRANSFER" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bank_name">Bank name</Label>
                <Input id="bank_name" {...register("bank_name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account_no">Account number</Label>
                <Input id="account_no" {...register("account_no")} />
              </div>
            </div>
          )}

          {type === "MFS" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfs_type">MFS provider</Label>
                <Controller
                  control={control}
                  name="mfs_type"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="mfs_type" className="w-full">
                        <SelectValue>{(v: string) => v || "Select provider"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MFS_TYPES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mobile_no">Mobile number</Label>
                <Input id="mobile_no" {...register("mobile_no")} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Add instrument"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

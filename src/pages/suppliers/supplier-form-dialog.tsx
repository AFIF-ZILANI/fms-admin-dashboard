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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatchData, usePostData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { SUPPLIER_ROLES, SUPPLY_CATEGORIES, type Supplier } from "@/pages/suppliers/types";

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(1, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(SUPPLIER_ROLES, "Select a role"),
  supplies: z.array(z.enum(SUPPLY_CATEGORIES)).min(1, "Select at least one supply category"),
  company: z.string().trim().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

type SupplierFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
};

export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const isEdit = Boolean(supplier);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", mobile: "", email: "", address: "", role: undefined, supplies: [], company: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        supplier
          ? {
              name: supplier.profile.name,
              mobile: supplier.profile.mobile,
              email: supplier.profile.email ?? "",
              address: supplier.profile.address ?? "",
              role: supplier.role,
              supplies: supplier.supplies,
              company: supplier.company ?? "",
            }
          : { name: "", mobile: "", email: "", address: "", role: undefined, supplies: [], company: "" }
      );
    }
  }, [open, supplier, reset]);

  const createSupplier = usePostData<Supplier, SupplierFormValues>("/suppliers", ["suppliers"]);
  const updateSupplier = usePatchData<Supplier, SupplierFormValues>(`/suppliers/${supplier?.id}`, ["suppliers"]);
  const mutation = isEdit ? updateSupplier : createSupplier;

  const onSubmit = (values: SupplierFormValues) => {
    const payload = {
      ...values,
      email: values.email || undefined,
      address: values.address || undefined,
      company: values.company || undefined,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Supplier updated" : "Supplier created");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "mobile", "email", "address", "role", "supplies", "company"] as const) {
          const message = error.fieldError(key);
          if (message) {
            setError(key, { message });
            hadFieldError = true;
          }
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this supplier's details." : "Register a new purchase counterparty."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" {...register("mobile")} aria-invalid={!!errors.mobile} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" {...register("company")} aria-invalid={!!errors.company} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register("address")} aria-invalid={!!errors.address} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
                    <SelectValue>{(value: string) => (value ? humanizeEnum(value) : "Select role")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {humanizeEnum(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Supplies</Label>
            <Controller
              control={control}
              name="supplies"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {SUPPLY_CATEGORIES.map((category) => {
                    const checked = field.value?.includes(category) ?? false;
                    return (
                      <label key={category} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            const next = isChecked
                              ? [...(field.value ?? []), category]
                              : (field.value ?? []).filter((c) => c !== category);
                            field.onChange(next);
                          }}
                        />
                        {humanizeEnum(category)}
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.supplies && <p className="text-xs text-destructive">{errors.supplies.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

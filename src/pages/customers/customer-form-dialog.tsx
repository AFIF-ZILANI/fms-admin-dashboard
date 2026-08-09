import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { usePatchData, usePostData } from "@/lib/api";
import type { Customer } from "@/pages/customers/types";

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(1, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  company: z.string().trim().optional(),
  // kept as a raw string (not z.coerce.number) so the form's input/output types
  // stay identical — no native number input, no RHF 3-generic split needed.
  rating: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 5), "Rating must be between 0 and 5"),
});

type CustomerFormValues = z.infer<typeof customerSchema>;
type CustomerPayload = Omit<CustomerFormValues, "rating"> & { rating?: number };

type CustomerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
};

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const isEdit = Boolean(customer);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", mobile: "", email: "", address: "", company: "", rating: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? {
              name: customer.profile.name,
              mobile: customer.profile.mobile,
              email: customer.profile.email ?? "",
              address: customer.profile.address ?? "",
              company: customer.company ?? "",
              rating: customer.rating != null ? String(customer.rating) : "",
            }
          : { name: "", mobile: "", email: "", address: "", company: "", rating: "" }
      );
    }
  }, [open, customer, reset]);

  const createCustomer = usePostData<Customer, CustomerPayload>("/customers", ["customers"]);
  const updateCustomer = usePatchData<Customer, CustomerPayload>(`/customers/${customer?.id}`, ["customers"]);
  const mutation = isEdit ? updateCustomer : createCustomer;

  const onSubmit = (values: CustomerFormValues) => {
    const payload = {
      name: values.name,
      mobile: values.mobile,
      email: values.email || undefined,
      address: values.address || undefined,
      company: values.company || undefined,
      // create doesn't accept rating at all (docs/api.md §4.2) — only send it on edit.
      ...(isEdit && values.rating ? { rating: Number(values.rating) } : {}),
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Customer updated" : "Customer created");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "mobile", "email", "address", "company", "rating"] as const) {
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
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this customer's details." : "Register a new sale counterparty."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
              <Input id="company" {...register("company")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register("address")} />
          </div>

          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rating">Rating (0–5, optional)</Label>
              <Input
                id="rating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                {...register("rating")}
                aria-invalid={!!errors.rating}
              />
              {errors.rating && <p className="text-xs text-destructive">{errors.rating.message}</p>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

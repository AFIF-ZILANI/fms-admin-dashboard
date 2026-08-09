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
import type { Admin } from "@/pages/admins/types";

const adminSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(1, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

type AdminFormValues = z.infer<typeof adminSchema>;

type AdminFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin?: Admin;
};

export function AdminFormDialog({ open, onOpenChange, admin }: AdminFormDialogProps) {
  const isEdit = Boolean(admin);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: "", mobile: "", email: "", address: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        admin
          ? {
              name: admin.profile.name,
              mobile: admin.profile.mobile,
              email: admin.profile.email ?? "",
              address: admin.profile.address ?? "",
            }
          : { name: "", mobile: "", email: "", address: "" }
      );
    }
  }, [open, admin, reset]);

  const createAdmin = usePostData<Admin, AdminFormValues>("/admins", ["admins"]);
  const updateAdmin = usePatchData<Admin, AdminFormValues>(`/admins/${admin?.id}`, ["admins"]);
  const mutation = isEdit ? updateAdmin : createAdmin;

  const onSubmit = (values: AdminFormValues) => {
    const payload = { ...values, email: values.email || undefined, address: values.address || undefined };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Admin updated" : "Admin created");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "mobile", "email", "address"] as const) {
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit admin" : "Add admin"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this admin's details." : "Register a new admin account. Flat permissions — every admin has full access."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register("address")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

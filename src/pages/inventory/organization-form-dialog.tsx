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
import type { Organization } from "@/pages/inventory/types";

const organizationSchema = z.object({ label_name: z.string().trim().min(1, "Name is required") });
type OrganizationFormValues = z.infer<typeof organizationSchema>;

type OrganizationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization;
};

export function OrganizationFormDialog({ open, onOpenChange, organization }: OrganizationFormDialogProps) {
  const isEdit = Boolean(organization);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { label_name: "" },
  });

  useEffect(() => {
    if (open) reset({ label_name: organization?.label_name ?? "" });
  }, [open, organization, reset]);

  const createOrganization = usePostData<Organization, OrganizationFormValues>("/organizations", ["organizations"]);
  const updateOrganization = usePatchData<Organization, OrganizationFormValues>(
    `/organizations/${organization?.id}`,
    ["organizations"]
  );
  const mutation = isEdit ? updateOrganization : createOrganization;

  const onSubmit = (values: OrganizationFormValues) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(isEdit ? "Organization updated" : "Organization created");
        onOpenChange(false);
      },
      onError: (error) => {
        const message = error.fieldError("label_name");
        if (message) setError("label_name", { message });
        else toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit organization" : "Add organization"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this organization's name."
              : "Register a manufacturer, importer, marketer, or distributor for recall tracing."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label_name">Name</Label>
            <Input
              id="label_name"
              placeholder="e.g. ACI Animal Health"
              {...register("label_name")}
              aria-invalid={!!errors.label_name}
            />
            {errors.label_name && <p className="text-xs text-destructive">{errors.label_name.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

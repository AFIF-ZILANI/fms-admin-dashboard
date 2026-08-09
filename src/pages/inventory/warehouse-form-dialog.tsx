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
import type { Warehouse } from "@/pages/inventory/types";

const warehouseSchema = z.object({ name: z.string().trim().min(1, "Name is required") });
type WarehouseFormValues = z.infer<typeof warehouseSchema>;

type WarehouseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
};

export function WarehouseFormDialog({ open, onOpenChange, warehouse }: WarehouseFormDialogProps) {
  const isEdit = Boolean(warehouse);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseFormValues>({ resolver: zodResolver(warehouseSchema), defaultValues: { name: "" } });

  useEffect(() => {
    if (open) reset({ name: warehouse?.name ?? "" });
  }, [open, warehouse, reset]);

  const createWarehouse = usePostData<Warehouse, WarehouseFormValues>("/warehouses", ["warehouses"]);
  const updateWarehouse = usePatchData<Warehouse, WarehouseFormValues>(`/warehouses/${warehouse?.id}`, [
    "warehouses",
  ]);
  const mutation = isEdit ? updateWarehouse : createWarehouse;

  const onSubmit = (values: WarehouseFormValues) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(isEdit ? "Warehouse renamed" : "Warehouse created");
        onOpenChange(false);
      },
      onError: (error) => {
        const message = error.fieldError("name");
        if (message) setError("name", { message });
        else toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Rename warehouse" : "Add warehouse"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this storage location's name." : "Register a new storage location."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Main Warehouse" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

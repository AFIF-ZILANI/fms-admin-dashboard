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
import { usePatchData, usePostData } from "@/lib/api";
import { optionalNumber } from "@/lib/zod-helpers";
import { HOUSE_TYPES, type House } from "@/pages/houses/types";

const houseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(HOUSE_TYPES, "Select a house type"),
  number: z.coerce.number().int().positive("Must be a positive number"),
  capacity: optionalNumber(z.coerce.number().int().positive()),
});

// z.coerce fields make the schema's input type (raw form values) differ from
// its output type (parsed payload) — RHF's 3rd generic carries that through.
type HouseFormInput = z.input<typeof houseSchema>;
type HouseFormValues = z.output<typeof houseSchema>;

type HouseFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  house?: House;
};

export function HouseFormDialog({ open, onOpenChange, house }: HouseFormDialogProps) {
  const isEdit = Boolean(house);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HouseFormInput, unknown, HouseFormValues>({
    resolver: zodResolver(houseSchema),
    defaultValues: { name: "", type: undefined, number: undefined, capacity: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        house
          ? { name: house.name, type: house.type, number: house.number, capacity: house.capacity ?? "" }
          : { name: "", type: undefined, number: undefined, capacity: "" }
      );
    }
  }, [open, house, reset]);

  const createHouse = usePostData<House, HouseFormValues>("/houses", ["houses"]);
  const updateHouse = usePatchData<House, HouseFormValues>(`/houses/${house?.id}`, ["houses"]);
  const mutation = isEdit ? updateHouse : createHouse;

  const onSubmit = (values: HouseFormValues) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(isEdit ? "House updated" : "House created");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of ["name", "type", "number", "capacity"] as const) {
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit house" : "Add house"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this house's details." : "Register a new house for batches to occupy."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Brooder House 1" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="type" className="w-full" aria-invalid={!!errors.type}>
                      <SelectValue>
                        {(value: string) => (value ? value.charAt(0) + value.slice(1).toLowerCase() : "Select type")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {HOUSE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="number">Number</Label>
              <Input
                id="number"
                type="number"
                placeholder="e.g. 1"
                {...register("number")}
                aria-invalid={!!errors.number}
              />
              {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacity">Capacity (optional)</Label>
            <Input
              id="capacity"
              type="number"
              placeholder="Max birds — leave blank for no limit"
              {...register("capacity")}
              aria-invalid={!!errors.capacity}
            />
            {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create house"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

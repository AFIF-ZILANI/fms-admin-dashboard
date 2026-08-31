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
import { usePostData } from "@/lib/api";
import type { StockUnit } from "@/pages/inventory/types";

const provisionSchema = z.object({
  count: z.coerce.number().int().positive().max(500, "At most 500 codes at a time"),
});
// z.coerce makes the schema's input type (raw form value) differ from its output
// type (parsed number) -- RHF's 3rd generic carries that through (same pattern as Adjustments/Items).
type ProvisionFormInput = z.input<typeof provisionSchema>;
type ProvisionFormValues = z.output<typeof provisionSchema>;

type ProvisionCodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired with the freshly created units so the caller can open the print sheet. */
  onProvisioned: (units: StockUnit[]) => void;
};

export function ProvisionCodesDialog({ open, onOpenChange, onProvisioned }: ProvisionCodesDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionFormInput, unknown, ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { count: undefined },
  });

  const provision = usePostData<StockUnit[], ProvisionFormValues>("/stock-units", ["stock-units"]);

  const onSubmit = (values: ProvisionFormValues) => {
    provision.mutate(values, {
      onSuccess: (units) => {
        toast.success(`${units.length} codes provisioned`);
        reset();
        onOpenChange(false);
        onProvisioned(units);
      },
      onError: (error) => {
        const message = error.fieldError("count");
        if (message) setError("count", { message });
        else toast.error(error.message);
      },
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Provision blank codes</DialogTitle>
          <DialogDescription>
            Batch-creates a run of unbound QR codes ahead of need. The print sheet opens next.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="count">How many codes?</Label>
            <Input id="count" type="number" step="1" {...register("count")} aria-invalid={!!errors.count} />
            {errors.count && <p className="text-xs text-destructive">{errors.count.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Provision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

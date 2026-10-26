import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
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
import { CODES_PER_PAGE, PRINT_LAYOUT, type StockUnit } from "@/pages/inventory/types";

/** Server cap per request (stock-unit.validator.ts). */
const MAX_CODES = 1170; // 10 full A4 pages of 117
const MAX_PAGES = Math.floor(MAX_CODES / CODES_PER_PAGE);

type Mode = "pages" | "codes";

const provisionSchema = z.object({
  amount: z.coerce.number().int("Whole numbers only").positive("Must be at least 1"),
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
  const [mode, setMode] = useState<Mode>("pages");
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionFormInput, unknown, ProvisionFormValues>({
    resolver: zodResolver(provisionSchema),
    defaultValues: { amount: undefined },
  });

  const provision = usePostData<StockUnit[], { count: number }>("/stock-units", ["stock-units"]);

  const raw = watch("amount");
  const amount = raw === undefined || raw === "" ? NaN : Number(raw);
  const count = Number.isInteger(amount) && amount > 0 ? (mode === "pages" ? amount * CODES_PER_PAGE : amount) : 0;
  const pages = Math.ceil(count / CODES_PER_PAGE);
  const lastPageCodes = count % CODES_PER_PAGE;

  const onSubmit = (values: ProvisionFormValues) => {
    const total = mode === "pages" ? values.amount * CODES_PER_PAGE : values.amount;
    if (total > MAX_CODES) {
      setError("amount", {
        message:
          mode === "pages"
            ? `At most ${MAX_PAGES} pages (${MAX_PAGES * CODES_PER_PAGE} codes) at a time`
            : `At most ${MAX_CODES} codes at a time`,
      });
      return;
    }
    return provision.mutate(
      { count: total },
      {
        onSuccess: (units) => {
          toast.success(`${units.length} codes provisioned`);
          reset();
          onOpenChange(false);
          onProvisioned(units);
        },
        onError: (error) => {
          const message = error.fieldError("count");
          if (message) setError("amount", { message });
          else toast.error(error.message);
        },
      }
    );
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    clearErrors("amount");
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
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Provision by">
            {(["pages", "codes"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                variant={mode === m ? "outline" : "ghost"}
                size="sm"
                onClick={() => switchMode(m)}
              >
                {m === "pages" ? "By pages" : "By codes"}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">{mode === "pages" ? "How many A4 pages?" : "How many codes?"}</Label>
            <Input
              id="amount"
              type="number"
              step="1"
              min="1"
              max={mode === "pages" ? MAX_PAGES : MAX_CODES}
              {...register("amount")}
              aria-invalid={!!errors.amount}
            />
            {errors.amount ? (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            ) : (
              count > 0 && (
                <p className="text-xs text-muted-foreground">
                  {mode === "pages"
                    ? `${count} codes`
                    : `${pages} page${pages === 1 ? "" : "s"}${
                        lastPageCodes ? ` · last page has ${lastPageCodes} of ${CODES_PER_PAGE}` : ""
                      }`}
                </p>
              )
            )}
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">Print layout · A4 (210 × 297 mm)</p>
            <ul className="flex flex-col gap-0.5">
              <li>
                QR size: {PRINT_LAYOUT.codeMm} × {PRINT_LAYOUT.codeMm} mm ({PRINT_LAYOUT.codeMm / 10} cm)
              </li>
              <li>
                Grid: {PRINT_LAYOUT.columns} columns × {PRINT_LAYOUT.rows} rows = {CODES_PER_PAGE} codes per page
              </li>
              <li>
                Gap {PRINT_LAYOUT.gapMm} mm between codes · page margin {PRINT_LAYOUT.marginMm} mm
              </li>
              <li>
                Up to {MAX_CODES} codes ({MAX_PAGES} full pages) per batch · print at 100% / “Actual size”
              </li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {count > 0 ? `Provision ${count}` : "Provision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

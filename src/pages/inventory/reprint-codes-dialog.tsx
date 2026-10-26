import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/utils/NumaricInput";
import { apiFetch, type Paginated } from "@/lib/api";
import { CODES_PER_PAGE, type StockUnit } from "@/pages/inventory/types";

/** The list API caps `limit` at 100. */
const API_PAGE = 100;

type Mode = "pages" | "codes";
type Source = "UNASSIGNED" | "PRINTED";

type ReprintCodesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Server counts per printable status -- caps how many each source can print. */
  counts: Record<Source, number>;
  /** Fired with the fetched ids so the caller can open the print sheet. */
  onReady: (ids: string[]) => void;
};

// Print blank codes by count/pages, not just the table's visible page -- fetches the newest N ids
// of the chosen source straight from the API (newest first, matching the list order): never-printed
// UNASSIGNED codes, or PRINTED ones again for a lost/damaged sheet.
// ponytail: fans out ceil(N/100) list calls (12 for 10 pages); add an ids-only endpoint if N grows.
export function ReprintCodesDialog({ open, onOpenChange, counts, onReady }: ReprintCodesDialogProps) {
  const [source, setSource] = useState<Source>("UNASSIGNED");
  const [mode, setMode] = useState<Mode>("pages");
  const available = counts[source];
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const n = Number(amount);
  const count = n > 0 ? (mode === "pages" ? n * CODES_PER_PAGE : n) : 0;
  const pages = Math.ceil(count / CODES_PER_PAGE);
  const lastPageCodes = count % CODES_PER_PAGE;
  const availablePages = Math.ceil(available / CODES_PER_PAGE);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setAmount("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (count === 0) return setError("Must be at least 1");
    if (mode === "pages" ? n > availablePages : count > available) {
      return setError(
        mode === "pages"
          ? `Only ${availablePages} page${availablePages === 1 ? "" : "s"} of codes available`
          : `Only ${available} code${available === 1 ? "" : "s"} available`
      );
    }
    // The last of the requested pages may run short -- print what exists for it.
    const wanted = Math.min(count, available);
    setLoading(true);
    try {
      const calls = Array.from({ length: Math.ceil(wanted / API_PAGE) }, (_, i) =>
        apiFetch<Paginated<StockUnit>>(`/stock-units?status=${source}&limit=${API_PAGE}&page=${i + 1}`)
      );
      const ids = (await Promise.all(calls)).flatMap((p) => p.results.map((u) => u.id)).slice(0, wanted);
      handleClose(false);
      onReady(ids);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load codes");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print blank codes</DialogTitle>
          <DialogDescription>
            {counts.UNASSIGNED} not printed yet · {counts.PRINTED} printed, not bound. Prints the newest first.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Which codes">
            {(["UNASSIGNED", "PRINTED"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                variant={source === s ? "outline" : "ghost"}
                size="sm"
                onClick={() => {
                  setSource(s);
                  setError(null);
                }}
              >
                {s === "UNASSIGNED" ? `New (${counts.UNASSIGNED})` : `Reprint printed (${counts.PRINTED})`}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Print by">
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
            <Label htmlFor="reprint-amount">{mode === "pages" ? "How many A4 pages?" : "How many codes?"}</Label>
            <NumericInput
              id="reprint-amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              count > 0 && (
                <p className="text-xs text-muted-foreground">
                  {mode === "pages"
                    ? `${Math.min(count, available)} codes`
                    : `${pages} page${pages === 1 ? "" : "s"}${
                        lastPageCodes ? ` · last page has ${lastPageCodes} of ${CODES_PER_PAGE}` : ""
                      }`}
                </p>
              )
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || available === 0}>
              {loading && <Loader2 className="animate-spin" />}
              Print
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

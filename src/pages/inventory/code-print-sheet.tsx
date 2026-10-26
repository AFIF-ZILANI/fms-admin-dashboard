import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Printer } from "lucide-react";
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
import { usePostData } from "@/lib/api";
import { CODES_PER_PAGE, PRINT_LAYOUT } from "@/pages/inventory/types";

type CodePrintSheetProps = {
  /** Unit ids -- each id IS the QR payload, so no other fields are needed to print. */
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Shared QR print sheet -- used after provisioning and by "Print blank codes". After the browser
// print dialog closes it asks whether the labels came out; Yes moves UNASSIGNED codes to PRINTED
// (the only status bind accepts). The browser can't tell a real print from a cancel, hence asking. Codes print at a fixed 19mm (index.css @media print) in a uniform grid that packs A4.
// The QR carries the full id; no human-readable label -- the workflow is scan-only.
export function CodePrintSheet({ ids, open, onOpenChange }: CodePrintSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const markPrinted = usePostData<{ updated: number }, { ids: string[] }>("/stock-units/mark-printed", ["stock-units"]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setConfirming(false);
    onOpenChange(next);
  };

  const confirmPrinted = () =>
    markPrinted.mutate(
      { ids },
      {
        onSuccess: ({ updated }) => {
          toast.success(updated ? `${updated} code${updated === 1 ? "" : "s"} marked printed` : "Codes reprinted");
          handleOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );

  // The sheet sits inside base-ui's fixed, screen-centered dialog, which becomes the containing
  // block for #printable-codes' `position:absolute` -- so it printed from the middle of the page.
  // Hoist the node to <body> for the duration of printing so it resolves against the page top-left,
  // then put it back where it was.
  const handlePrint = () => {
    const node = document.getElementById("printable-codes");
    if (!node) return;
    const parent = node.parentElement!;
    const anchor = node.nextSibling;
    document.body.appendChild(node);
    const restore = () => {
      parent.insertBefore(node, anchor);
      window.removeEventListener("afterprint", restore);
      setConfirming(true);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Print codes</DialogTitle>
          <DialogDescription>
            {ids.length} code{ids.length === 1 ? "" : "s"} · {PRINT_LAYOUT.codeMm / 10} cm, {CODES_PER_PAGE} per A4
            page. In the browser print dialog
            set scale to "Actual size" / 100% so codes print at true size.
          </DialogDescription>
        </DialogHeader>

        <div
          id="printable-codes"
          className="grid max-h-[60vh] grid-cols-[repeat(auto-fill,72px)] justify-center gap-3 overflow-auto rounded-md border border-border bg-white p-4"
        >
          {ids.map((id) => (
            <div key={id} className="print-cell w-[72px]">
              <QRCodeSVG value={id} size={72} level="M" />
            </div>
          ))}
        </div>

        {confirming ? (
          <DialogFooter className="items-center print:hidden sm:justify-between">
            <p className="text-sm font-medium">Did the labels print OK?</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                No, try again
              </Button>
              <Button type="button" onClick={confirmPrinted} disabled={markPrinted.isPending}>
                {markPrinted.isPending && <Loader2 className="animate-spin" />}
                Yes, mark printed
              </Button>
            </div>
          </DialogFooter>
        ) : (
          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button type="button" onClick={handlePrint} disabled={ids.length === 0}>
              <Printer />
              Print
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CodePrintSheetProps = {
  /** Unit ids -- each id IS the QR payload, so no other fields are needed to print. */
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Shared QR print sheet -- used both after provisioning and to re-print any selection from the
// table. Codes print at exactly 2.5cm (index.css @media print) and flex-wrap to fill A4. The QR
// carries the full id; the label under it is the 8-char prefix (a full uuid won't fit legibly).
export function CodePrintSheet({ ids, open, onOpenChange }: CodePrintSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Print codes</DialogTitle>
          <DialogDescription>
            {ids.length} code{ids.length === 1 ? "" : "s"} · 2.5 cm on A4. In the browser print dialog
            set scale to "Actual size" / 100% so codes print at true size.
          </DialogDescription>
        </DialogHeader>

        <div
          id="printable-codes"
          className="flex max-h-[60vh] flex-wrap justify-center gap-3 overflow-auto rounded-md border border-border bg-white p-4"
        >
          {ids.map((id) => (
            <div key={id} className="print-cell flex w-[94px] flex-col items-center gap-1">
              <QRCodeSVG value={id} size={94} level="M" />
              <span className="code-label font-mono text-[9px] leading-none">{id.slice(0, 8)}</span>
            </div>
          ))}
        </div>

        <DialogFooter className="print:hidden">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => window.print()} disabled={ids.length === 0}>
            <Printer />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

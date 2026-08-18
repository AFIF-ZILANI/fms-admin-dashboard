import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BindCodeDialog } from "@/pages/inventory/bind-code-dialog";
import type { Purchase } from "@/pages/purchases/types";

// ponytail: these are live ItemCategory.code values a user can rename via
// Settings, which silently breaks this "which lines need codes" check with
// no error -- needs a stable-key mechanism (e.g. an is_system flag) if
// renaming these specific categories becomes a real risk.
const CODED_CATEGORIES = ["MEDICINE", "VACCINE", "EQUIPMENT"];

type BindCodesPromptProps = {
  /** The just-recorded purchase, or null when the prompt should be closed. */
  purchase: Purchase | null;
  /** Fires once the prompt (and any bind dialog it opened) is fully done —
   * on skip, or after the bind dialog itself closes. */
  onDone: () => void;
};

/** Post-save nudge for PRD §6.8's "bind stock unit codes for this delivery?"
 * flow -- only ever rendered when the purchase actually has a coded-category
 * line item (the caller checks this before setting `purchase`). */
export function BindCodesPrompt({ purchase, onDone }: BindCodesPromptProps) {
  const [bindOpen, setBindOpen] = useState(false);

  if (!purchase) return null;

  const scopedLots = purchase.items.filter((line) => CODED_CATEGORIES.includes(line.item.category));

  return (
    <>
      <Dialog open={!bindOpen} onOpenChange={(open) => !open && onDone()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bind stock unit codes?</DialogTitle>
            <DialogDescription>
              This purchase includes coded items — bind stock unit codes for this delivery now, so you don't need a
              second trip to Inventory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onDone}>
              Skip
            </Button>
            <Button type="button" onClick={() => setBindOpen(true)}>
              Bind codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BindCodeDialog
        open={bindOpen}
        onOpenChange={(open) => {
          setBindOpen(open);
          if (!open) onDone();
        }}
        scopedLots={scopedLots}
      />
    </>
  );
}

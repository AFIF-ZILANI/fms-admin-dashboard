import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive tone -- for deletes and other irreversible actions. */
  destructive?: boolean;
};

// Promise-based replacement for window.confirm(), rendered as a shadcn dialog. Call the returned
// `confirm(opts)` -- it resolves true on confirm and false on cancel/dismiss -- and render
// `confirmDialog` once in the component. ponytail: single-flight (one prompt at a time, which is
// all a click-driven confirm ever needs); a second call before the first settles drops the first.
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    resolver.current(result);
    setOptions(null);
  };

  const confirmDialog = (
    <Dialog open={!!options} onOpenChange={(open) => !open && settle(false)}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={options?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, confirmDialog };
}

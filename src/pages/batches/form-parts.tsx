import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared by the batch health forms (disease case, mortality).

/** A pill that toggles on and off -- for picking houses and symptoms at a glance. */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
      )}
    >
      {on && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

/** One titled group of fields in the dialog body. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SALE_KIND_LABEL } from "@/pages/sales/sale-kinds";
import type { SaleKind } from "@/pages/sales/types";

const KINDS: { kind: SaleKind; description: string }[] = [
  {
    kind: "CODED",
    description: "Medicine, vaccine and other items with a QR code. Each pack is scanned out on the phone.",
  },
  { kind: "STOCK", description: "Feed, rice husk and other stock sold by amount from a warehouse." },
  { kind: "FARM_MADE", description: "Litter and other things the farm makes. Nothing is taken from stock." },
];

/** The first choice on the Record sale page: what is being sold decides every field after it. */
export function SaleKindPicker({ value, onChange }: { value: SaleKind | null; onChange: (kind: SaleKind) => void }) {
  return (
    <div role="radiogroup" aria-labelledby="sale-kind-heading" className="grid gap-3 sm:grid-cols-3">
      {KINDS.map(({ kind, description }) => {
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/30 hover:bg-muted/40"
            )}
          >
            <span className="flex items-center justify-between gap-2 font-medium">
              {SALE_KIND_LABEL[kind]}
              {selected && <Check className="size-4 text-primary" aria-hidden />}
            </span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </button>
        );
      })}
    </div>
  );
}

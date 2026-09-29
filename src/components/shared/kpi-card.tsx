import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type KPICardProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  isLoading?: boolean;
  /** Render a dash instead of a value. A failed money fetch must never display
   * as 0 -- that reads as "a quiet day", not "we don't know". */
  isError?: boolean;
  /** Small line under the value, e.g. to say a figure ignores the date range. */
  hint?: string;
  /** Colours the value when the number itself is the problem — money owed past
   * its due date, staff who can't be paid. Left off, a tile reads as neutral. */
  tone?: "critical" | "warning";
};

/** label → value (32px, tabular) → icon, per docs/design.md §5. Reused on every page that opens with a stats row. */
export function KPICard({ label, value, icon: Icon, isLoading, isError, hint, tone }: KPICardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : isError ? (
            <p className="mt-1 text-[32px] leading-none font-semibold text-muted-foreground">—</p>
          ) : (
            <p
              className={`mt-1 text-[32px] leading-none font-semibold tabular-nums ${
                tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : ""
              }`}
            >
              {value}
            </p>
          )}
          {hint && !isLoading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}

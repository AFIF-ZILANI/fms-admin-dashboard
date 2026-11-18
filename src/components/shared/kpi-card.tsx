import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTk, formatTkShort } from "@/lib/utils";

type KPICardProps = {
  label: string;
  value?: ReactNode;
  /** A taka amount. Shown short ("৳1.7Cr", "৳2K") so a 30Cr figure can't blow the tile out; the exact
   * figure is the hover tooltip. null/undefined renders "—". Use this instead of `value` for money. */
  money?: string | number | null;
  /** With `money`: put a "+" in front of a positive amount (net change tiles). */
  signed?: boolean;
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
export function KPICard({ label, value, money, signed, icon: Icon, isLoading, isError, hint, tone }: KPICardProps) {
  const amount = money == null ? NaN : Number(money);
  const isMoney = !Number.isNaN(amount);
  const shown = isMoney ? `${signed && amount > 0 ? "+" : ""}${formatTkShort(amount)}` : (value ?? "—");
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : isError ? (
            <p className="mt-1 text-[32px] leading-none font-semibold text-muted-foreground">—</p>
          ) : (
            <p
              title={isMoney ? formatTk(amount) : typeof shown === "string" ? shown : undefined}
              className={`mt-1 truncate text-[32px] leading-none font-semibold tabular-nums ${
                tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : ""
              }`}
            >
              {shown}
            </p>
          )}
          {hint && !isLoading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}

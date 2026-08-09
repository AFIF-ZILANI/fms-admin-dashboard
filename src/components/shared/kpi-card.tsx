import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type KPICardProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  isLoading?: boolean;
};

/** label → value (32px, tabular) → icon, per docs/design.md §5. Reused on every page that opens with a stats row. */
export function KPICard({ label, value, icon: Icon, isLoading }: KPICardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums">{value}</p>
          )}
        </div>
        {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  );
}

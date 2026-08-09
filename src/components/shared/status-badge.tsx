import { CheckCircle2, Info, AlertTriangle, AlertCircle, Circle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "info" | "warning" | "critical" | "neutral";

const TONE_CONFIG: Record<Tone, { className: string; icon: LucideIcon }> = {
  success: { className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  info: { className: "bg-info/10 text-info border-info/20", icon: Info },
  warning: { className: "bg-warning/10 text-warning border-warning/20", icon: AlertTriangle },
  critical: { className: "bg-critical/10 text-critical border-critical/20", icon: AlertCircle },
  neutral: { className: "bg-neutral-status/10 text-neutral-status border-neutral-status/20", icon: Circle },
};

/** One badge component for every status vocabulary in the app (docs/design.md §6) — never invent a page-local variant. */
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  const { className, icon: Icon } = TONE_CONFIG[tone];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

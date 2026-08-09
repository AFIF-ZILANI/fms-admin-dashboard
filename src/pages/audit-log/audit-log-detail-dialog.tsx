import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { humanizeEnum } from "@/lib/utils";
import type { AuditAction, AuditLogEntry } from "@/pages/audit-log/types";

const ACTION_TONE: Record<AuditAction, Tone> = { CREATE: "success", UPDATE: "info", DELETE: "critical" };

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

type AuditLogDetailDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; entry: AuditLogEntry | undefined };

// ponytail: shows before/after JSON side by side, not a field-level diff —
// this table is unpopulated until Phase 15 (Auth) ships write-side
// middleware, so a real diff algorithm has nothing to validate against yet.
export function AuditLogDetailDialog({ open, onOpenChange, entry }: AuditLogDetailDialogProps) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusBadge tone={ACTION_TONE[entry.action]} label={humanizeEnum(entry.action)} />
            {entry.table_name} · {entry.record_id}
          </DialogTitle>
          <DialogDescription>{new Date(entry.occurred_at).toLocaleString()}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <JsonBlock label="Before" value={entry.before_data} />
          <JsonBlock label="After" value={entry.after_data} />
        </div>

        {entry.note && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Note:</span> {entry.note}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

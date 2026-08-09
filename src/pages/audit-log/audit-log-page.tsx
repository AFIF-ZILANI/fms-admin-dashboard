import { useState } from "react";
import { History, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { AuditLogDetailDialog } from "@/pages/audit-log/audit-log-detail-dialog";
import { AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from "@/pages/audit-log/types";

const ACTION_TONE: Record<AuditAction, Tone> = { CREATE: "success", UPDATE: "info", DELETE: "critical" };

export function AuditLogPage() {
  usePageTitle("Audit Log");

  const [tableName, setTableName] = useState("");
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [selected, setSelected] = useState<AuditLogEntry | undefined>(undefined);

  const query = new URLSearchParams({ limit: "100" });
  if (tableName.trim()) query.set("table_name", tableName.trim());
  if (action !== "ALL") query.set("action", action);

  const { data, isLoading } = useGetData<Paginated<AuditLogEntry>>(`/audit-logs?${query}`, [
    "audit-logs",
    tableName,
    action,
  ]);
  const entries = data?.results ?? [];

  const columns: Column<AuditLogEntry>[] = [
    { key: "occurred_at", header: "When", render: (e) => new Date(e.occurred_at).toLocaleString() },
    { key: "table_name", header: "Table", render: (e) => e.table_name },
    { key: "record_id", header: "Record", render: (e) => e.record_id },
    {
      key: "action",
      header: "Action",
      render: (e) => <StatusBadge tone={ACTION_TONE[e.action]} label={humanizeEnum(e.action)} />,
    },
    { key: "note", header: "Note", render: (e) => e.note ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Filter by table name…"
          />
          {tableName && (
            <button
              type="button"
              onClick={() => setTableName("")}
              aria-label="Clear table filter"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={action} onValueChange={(v) => setAction((v as AuditAction | "ALL") ?? "ALL")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All actions")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {humanizeEnum(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        onRowClick={(e) => setSelected(e)}
        empty={{
          icon: History,
          title: "No audit history yet",
          description: "This table populates once write-side tracking ships — nothing to see here in the meantime.",
        }}
      />

      <AuditLogDetailDialog open={!!selected} onOpenChange={(open) => !open && setSelected(undefined)} entry={selected} />
    </div>
  );
}

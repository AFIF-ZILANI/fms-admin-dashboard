import { useState } from "react";
import { History } from "lucide-react";
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

  const [tableName, setTableName] = useState("ALL");
  const [action, setAction] = useState<AuditAction | "ALL">("ALL");
  const [selected, setSelected] = useState<AuditLogEntry | undefined>(undefined);

  const query = new URLSearchParams({ limit: "100" });
  if (tableName !== "ALL") query.set("table_name", tableName);
  if (action !== "ALL") query.set("action", action);

  const { data, isLoading } = useGetData<Paginated<AuditLogEntry>>(`/audit-logs?${query}`, [
    "audit-logs",
    tableName,
    action,
  ]);
  const entries = data?.results ?? [];
  const { data: tables } = useGetData<string[]>("/audit-logs/tables", ["audit-logs", "tables"]);

  const columns: Column<AuditLogEntry>[] = [
    { key: "occurred_at", header: "When", render: (e) => new Date(e.occurred_at).toLocaleString() },
    { key: "changed_by", header: "By", render: (e) => e.changed_by.name },
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
        <Select value={tableName} onValueChange={(v) => setTableName(v ?? "ALL")}>
          <SelectTrigger className="w-56" aria-label="Table">
            <SelectValue>{(v: string) => (v && v !== "ALL" ? v : "All tables")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All tables</SelectItem>
            {(tables ?? []).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        totalCount={data?.total}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        onRowClick={(e) => setSelected(e)}
        empty={{
          icon: History,
          title: "No audit history yet",
          description: "Purchases, sales, stock adjustments, batch changes, people and payouts are recorded here as they happen.",
        }}
      />

      <AuditLogDetailDialog open={!!selected} onOpenChange={(open) => !open && setSelected(undefined)} entry={selected} />
    </div>
  );
}

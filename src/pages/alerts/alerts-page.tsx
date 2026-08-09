import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { KPICard } from "@/components/shared/kpi-card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import {
  ALERT_LEVELS,
  ALERT_STATUSES,
  ALERT_TYPES,
  type Alert,
  type AlertLevel,
  type AlertStatus,
  type AlertType,
} from "@/pages/alerts/types";

const LEVEL_TONE: Record<AlertLevel, Tone> = { INFO: "info", WARNING: "warning", CRITICAL: "critical" };
const STATUS_TONE: Record<AlertStatus, Tone> = { ACTIVE: "warning", RESOLVED: "success" };

export function AlertsPage() {
  usePageTitle("Alerts");

  const [typeFilter, setTypeFilter] = useState<AlertType | "ALL">("ALL");
  const [levelFilter, setLevelFilter] = useState<AlertLevel | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("ACTIVE");

  const query = new URLSearchParams({ limit: "100" });
  if (typeFilter !== "ALL") query.set("type", typeFilter);
  if (levelFilter !== "ALL") query.set("level", levelFilter);
  if (statusFilter !== "ALL") query.set("status", statusFilter);

  const { data, isLoading } = useGetData<Paginated<Alert>>(`/alerts?${query}`, [
    "alerts",
    typeFilter,
    levelFilter,
    statusFilter,
  ]);
  const alerts = data?.results ?? [];

  const scan = usePostData<Paginated<Alert>, void>("/alerts/scan", ["alerts"]);
  const resolve = usePostData<Alert, string>((id) => `/alerts/${id}/resolve`, ["alerts"]);

  const onScan = () => {
    scan.mutate(undefined, {
      onSuccess: (result) => toast.success(`Scan complete — ${result.total} active alert${result.total === 1 ? "" : "s"}`),
      onError: (error) => toast.error(error.message),
    });
  };

  const onResolve = (alert: Alert) => {
    resolve.mutate(alert.id, {
      onSuccess: () => toast.success("Alert resolved"),
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<Alert>[] = [
    {
      key: "level",
      header: "Level",
      render: (a) => <StatusBadge tone={LEVEL_TONE[a.level]} label={humanizeEnum(a.level)} />,
    },
    { key: "type", header: "Type", render: (a) => humanizeEnum(a.type) },
    {
      key: "title",
      header: "Alert",
      render: (a) => (
        <div className="flex flex-col">
          <span className="font-medium">{a.title}</span>
          {a.description && <span className="text-xs text-muted-foreground">{a.description}</span>}
        </div>
      ),
    },
    { key: "created", header: "Raised", render: (a) => new Date(a.created_at).toLocaleString() },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge tone={STATUS_TONE[a.status]} label={humanizeEnum(a.status)} />,
    },
    {
      key: "actions",
      header: "",
      render: (a) =>
        a.status === "ACTIVE" ? (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => onResolve(a)} disabled={resolve.isPending && resolve.variables === a.id}>
              Resolve
            </Button>
          </div>
        ) : null,
      className: "text-right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Active alerts" value={statusFilter === "ACTIVE" ? alerts.length : "—"} icon={AlertTriangle} isLoading={isLoading} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter((v as AlertType | "ALL") ?? "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All types")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {ALERT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {humanizeEnum(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter((v as AlertLevel | "ALL") ?? "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All levels")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All levels</SelectItem>
              {ALERT_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {humanizeEnum(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter((v as AlertStatus | "ALL") ?? "ALL")}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => (v && v !== "ALL" ? humanizeEnum(v) : "All statuses")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {ALERT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {humanizeEnum(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onScan} disabled={scan.isPending}>
          <RefreshCw />
          Scan now
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={alerts}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        empty={{
          icon: AlertTriangle,
          title: statusFilter === "ACTIVE" ? "No active alerts — everything's within normal range." : "No alerts found",
          description: statusFilter === "ACTIVE" ? undefined : "Try a different filter, or run a scan.",
        }}
      />
    </div>
  );
}

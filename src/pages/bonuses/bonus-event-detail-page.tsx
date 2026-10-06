import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Gift, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PAYOUT_STATUS_TONE } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePostData } from "@/lib/api";
import { formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
import { RELIGION_LABELS } from "@/pages/employees/types";
import { PayoutDialog, type PayoutBonus } from "@/pages/employees/payout-dialog";
import type { Bonus, BonusEventDetail, Proposal, ProposalRow } from "@/pages/bonuses/types";

type PayTarget = { employeeId: string; bonus: PayoutBonus };

export function BonusEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: event } = useGetData<BonusEventDetail>(`/bonus-events/${id}`, ["bonus-events", id]);
  const { data: proposal, isLoading: proposalLoading } = useGetData<Proposal>(
    `/bonus-events/${id}/proposal`,
    ["bonus-events", id, "proposal"],
    { enabled: !!id },
  );
  usePageTitle(event?.name ?? "Bonus event");

  // null selection = "what the system proposed"; once the owner touches a box it is theirs.
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);

  const open = (proposal?.rows ?? []).filter((r) => !r.already_granted);
  const selectedIds = selection ?? new Set(open.filter((r) => r.selected).map((r) => r.employee_id));
  const amountFor = (r: ProposalRow) => amounts[r.employee_id] ?? Number(r.proposed_amount).toString();
  const chosen = open.filter((r) => selectedIds.has(r.employee_id));
  const total = chosen.reduce((sum, r) => sum + (Number(amountFor(r)) || 0), 0);
  const invalid = chosen.some((r) => !(Number(amountFor(r)) > 0));

  const grant = usePostData<unknown, object>(`/bonus-events/${id}/bonuses`, ["bonus-events", id]);

  const onGrant = () => {
    grant.mutate(
      { bonuses: chosen.map((r) => ({ employee_id: r.employee_id, amount: Number(amountFor(r)) })) },
      {
        onSuccess: () => {
          toast.success(`${chosen.length} bonus${chosen.length === 1 ? "" : "es"} granted`);
          setSelection(null);
          setAmounts({});
          void queryClient.invalidateQueries({ queryKey: ["bonus-events", id] });
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const proposalColumns: Column<ProposalRow>[] = [
    { key: "name", header: "Employee", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "status", header: "Status", render: (r) => humanizeEnum(r.employment_status) },
    {
      key: "religion",
      header: "Religion",
      render: (r) => (r.religion ? RELIGION_LABELS[r.religion] : <span className="text-muted-foreground">—</span>),
    },
    { key: "service", header: "Service", numeric: true, render: (r) => `${r.service_months} mo` },
    {
      key: "reason",
      header: "Note",
      render: (r) => (r.reason ? <span className="text-xs text-muted-foreground">{r.reason}</span> : null),
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      render: (r) => (
        <Input
          aria-label={`Bonus for ${r.name}`}
          type="number"
          className="ml-auto h-8 w-28 text-right tabular-nums"
          value={amountFor(r)}
          disabled={!selectedIds.has(r.employee_id)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setAmounts((a) => ({ ...a, [r.employee_id]: e.target.value }))}
        />
      ),
    },
  ];

  const bonusColumns: Column<Bonus>[] = [
    { key: "name", header: "Employee", render: (b) => <span className="font-medium">{b.employee.profile.name}</span> },
    { key: "service", header: "Service", numeric: true, render: (b) => `${b.service_months} mo` },
    { key: "amount", header: "Amount", numeric: true, render: (b) => formatMoney(b.amount) },
    {
      key: "status",
      header: "Payout",
      render: (b) =>
        b.payout ? (
          <StatusBadge tone={PAYOUT_STATUS_TONE[b.payout.status]} label={humanizeEnum(b.payout.status)} />
        ) : (
          <StatusBadge tone="warning" label="Unpaid" />
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (b) =>
        b.payout?.status === "CONFIRMED" ? (
          <span className="text-xs text-muted-foreground">
            Paid {b.payout.paid_at ? formatDate(b.payout.paid_at) : ""}
          </span>
        ) : (
          <Button
            size="sm"
            onClick={() =>
              setPayTarget({
                employeeId: b.employee_id,
                bonus: { id: b.id, amount: b.amount, event_name: event?.name ?? "" },
              })
            }
          >
            Pay
          </Button>
        ),
    },
  ];

  const granted = event?.bonuses ?? [];
  const grantedTotal = granted.reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/bonuses")}>
        <ArrowLeft />
        Back to bonuses
      </Button>

      {event && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard label="Date" value={formatDate(event.event_date)} icon={Gift} />
          <KPICard
            label="For"
            value={event.religion ? RELIGION_LABELS[event.religion] : "Everyone"}
            hint={`${Number(event.multiplier)} × salary`}
            icon={Users}
          />
          <KPICard
            label="Full bonus after"
            value={`${event.min_service_months} months`}
            hint={event.prorate ? "Prorated below that" : "Nothing below that"}
          />
          <KPICard label="Granted" value={formatMoney(grantedTotal)} hint={`${granted.length} employee${granted.length === 1 ? "" : "s"}`} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposed</CardTitle>
          <p className="text-xs text-muted-foreground">
            Computed from each employee's reference salary and service. Untick anyone, or change an amount, then grant.
          </p>
          <CardAction>
            <Button onClick={onGrant} disabled={chosen.length === 0 || invalid || grant.isPending}>
              Grant {chosen.length} · {formatMoney(total)}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={proposalColumns}
            rows={open}
            rowKey={(r) => r.employee_id}
            isLoading={proposalLoading}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelection}
            empty={{
              icon: Users,
              title: "Nobody left to propose",
              description: "Everyone eligible already has a bonus at this event.",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Granted</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={bonusColumns}
            rows={granted}
            rowKey={(b) => b.id}
            empty={{ icon: Gift, title: "No bonuses granted yet", description: "Grant the ones you've selected above." }}
          />
        </CardContent>
      </Card>

      <PayoutDialog
        open={payTarget !== null}
        onOpenChange={(o) => !o && setPayTarget(null)}
        employeeId={payTarget?.employeeId ?? ""}
        bonus={payTarget?.bonus ?? null}
      />
    </div>
  );
}

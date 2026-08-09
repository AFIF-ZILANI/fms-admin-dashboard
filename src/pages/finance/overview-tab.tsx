import { useState } from "react";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { FinancialDashboard } from "@/pages/finance/types";

export function OverviewTab() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useGetData<FinancialDashboard>(`/analytics/financial?month=${month}-01`, [
    "analytics",
    "financial",
    month,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 max-w-[10rem]">
        <Label htmlFor="month">Month</Label>
        <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Revenue" value={data ? formatMoney(data.revenue) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Expenses" value={data ? formatMoney(data.expenses) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard label="Gross profit" value={data ? formatMoney(data.gross_profit) : "—"} icon={Wallet} isLoading={isLoading} />
        <KPICard
          label="Outstanding payables"
          value={data ? formatMoney(data.outstanding_payables) : "—"}
          icon={Wallet}
          isLoading={isLoading}
        />
        <KPICard label="Cash position" value={data ? formatMoney(data.cash_position) : "—"} icon={Wallet} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash by instrument</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (data?.cash_by_instrument.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No payment instruments yet.</p>
          )}
          {data?.cash_by_instrument.map((i) => (
            <div key={i.instrument_id} className="flex items-center justify-between text-sm">
              <span>{i.label}</span>
              <span className="tabular-nums font-medium">{formatMoney(i.balance)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

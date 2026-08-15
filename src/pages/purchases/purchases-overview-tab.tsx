import { useState } from "react";
import { Package, Receipt, Wallet } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import type { PurchasesByCategoryRow } from "@/pages/analytics/types";
import type { Purchase } from "@/pages/purchases/types";
import { SpendByCategoryChart } from "@/pages/purchases/spend-by-category-chart";
import { PurchaseSpendTrendChart } from "@/pages/purchases/purchase-spend-trend-chart";
import { TopOutstandingSuppliersCard } from "@/pages/purchases/top-outstanding-suppliers-card";
import { useOutstanding } from "@/pages/sales/use-outstanding";

export function PurchasesOverviewTab() {
  const [days, setDays] = useState(30);

  const { data: byCategory, isLoading: byCategoryLoading } = useGetData<PurchasesByCategoryRow[]>(
    `/analytics/purchases/by-category?days=${days}`,
    ["analytics", "purchases", "by-category", days]
  );
  const { data: purchases, isLoading: purchasesLoading } = useGetData<Paginated<Purchase>>("/purchases?limit=100", [
    "purchases",
  ]);
  const { trueAmounts, isLoading: outstandingLoading } = useOutstanding("PURCHASE");

  const totalSpend = (byCategory ?? []).reduce((sum, r) => sum + parseFloat(r.total), 0);

  const since = Date.now() - days * 86_400_000;
  const purchaseCount = (purchases?.results ?? []).filter((p) => new Date(p.purchase_date).getTime() >= since).length;

  const outstandingDue = (purchases?.results ?? []).reduce(
    (sum, p) => sum + parseFloat(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
    0
  );

  const kpiLoading = byCategoryLoading || purchasesLoading || outstandingLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <DayRangeToggle value={days} onValueChange={setDays} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total spend" value={formatMoney(totalSpend)} icon={Wallet} isLoading={kpiLoading} />
        <KPICard label="Purchases" value={purchaseCount} icon={Package} isLoading={kpiLoading} />
        <KPICard
          label="Outstanding payable"
          value={formatMoney(outstandingDue)}
          icon={Receipt}
          isLoading={kpiLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendByCategoryChart days={days} />
        <PurchaseSpendTrendChart />
      </div>

      <TopOutstandingSuppliersCard />
    </div>
  );
}

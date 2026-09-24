import { useState } from "react";
import { ChevronDown, ChevronUp, Package, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Opens the page: how spending is trending, then the table you act on. One day-range
 * control drives everything below it -- the KPI row and both charts -- so a single
 * figure can't be read against a different window than the chart beside it. Collapsing
 * hides the whole block, leaving the page on the purchase list alone.
 */
export function PurchasesAnalyticsSection() {
  const [open, setOpen] = useState(true);
  const [days, setDays] = useState(30);

  const { data: byCategory, isLoading: byCategoryLoading } = useGetData<PurchasesByCategoryRow[]>(
    `/analytics/purchases/by-category?days=${days}`,
    ["analytics", "purchases", "by-category", days],
    { enabled: open }
  );
  const { data: purchases, isLoading: purchasesLoading } = useGetData<Paginated<Purchase>>(
    "/purchases?limit=100",
    ["purchases"],
    { enabled: open }
  );

  const { trueAmounts, isLoading: outstandingLoading } = useOutstanding("PURCHASE");

  const totalSpend = (byCategory ?? []).reduce((sum, r) => sum + parseFloat(r.total), 0);
  const since = Date.now() - days * 86_400_000;
  const purchaseCount = (purchases?.results ?? []).filter((p) => new Date(p.purchase_date).getTime() >= since).length;
  // Money still owed is a running total, not a windowed one -- what's unpaid from four
  // months ago is just as payable. Hinted on the card so it isn't read as a range figure.
  const outstandingDue = (purchases?.results ?? []).reduce(
    (sum, p) => sum + parseFloat(trueAmounts(p.id, p.paid_amount, p.due_amount).due),
    0
  );
  const kpiLoading = byCategoryLoading || purchasesLoading || outstandingLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp /> : <ChevronDown />}
          Analytics
        </Button>
        {open && <DayRangeToggle value={days} onValueChange={setDays} />}
      </div>

      {open && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KPICard label="Spend" value={formatMoney(totalSpend)} icon={Wallet} isLoading={kpiLoading} />
            <KPICard label="Purchases" value={purchaseCount} icon={Package} isLoading={kpiLoading} />
            <KPICard
              label="Outstanding payable"
              value={formatMoney(outstandingDue)}
              icon={Receipt}
              isLoading={kpiLoading}
              hint="All time, not the selected range"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SpendByCategoryChart days={days} />
            <PurchaseSpendTrendChart days={days} />
          </div>

          <TopOutstandingSuppliersCard />
        </div>
      )}
    </div>
  );
}

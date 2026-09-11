import { useState } from "react";
import { Bird, Receipt, TrendingUp, Wallet } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import { SalesPriceTrendChart } from "@/pages/analytics/sales-price-trend-chart";
import type { GradeDistributionRow, SalesByProductLineRow } from "@/pages/analytics/types";
import type { BirdSalesSummary, SalesSummary } from "@/pages/sales/types";
import { RevenueByProductLineChart } from "@/pages/sales/revenue-by-product-line-chart";
import { GradeDistributionChart } from "@/pages/sales/grade-distribution-chart";
import { TopOutstandingCustomersCard } from "@/pages/sales/top-outstanding-customers-card";

export function OverviewTab() {
  const [days, setDays] = useState(30);

  const {
    data: byProductLine,
    isLoading: byProductLineLoading,
    isError: byProductLineError,
  } = useGetData<SalesByProductLineRow[]>(`/analytics/sales/by-product-line?days=${days}`, [
    "analytics",
    "sales",
    "by-product-line",
    days,
  ]);
  const {
    data: gradeDistribution,
    isLoading: gradeDistributionLoading,
    isError: gradeDistributionError,
  } = useGetData<GradeDistributionRow[]>(`/analytics/sales/grade-distribution?days=${days}`, [
    "analytics",
    "sales",
    "grade-distribution",
    days,
  ]);
  const {
    data: saleSummary,
    isLoading: saleSummaryLoading,
    isError: saleSummaryError,
  } = useGetData<SalesSummary>("/sales/summary", ["sales", "summary"]);
  const {
    data: birdSummary,
    isLoading: birdSummaryLoading,
    isError: birdSummaryError,
  } = useGetData<BirdSalesSummary>("/bird-sales/summary", ["bird-sales", "summary"]);

  const totalRevenue = (byProductLine ?? []).reduce((sum, r) => sum + parseFloat(r.revenue), 0);
  const birdsSold = (gradeDistribution ?? []).reduce((sum, r) => sum + r.birds_count, 0);

  // Both halves come from the same server response over the same window. The
  // old client-side version used a different window boundary (exact ms vs the
  // server's UTC midnight) over only the latest page of bird sales, so this
  // tile and "Birds sold" beside it were measuring different things.
  const periodRevenue = (gradeDistribution ?? []).reduce((sum, r) => sum + parseFloat(r.revenue), 0);
  const periodNetWeight = (gradeDistribution ?? []).reduce((sum, r) => sum + parseFloat(r.net_weight), 0);
  const avgPricePerKg = periodNetWeight > 0 ? periodRevenue / periodNetWeight : 0;

  // Receivables are all-time, not period-scoped -- hence the tile's hint.
  const outstandingDue =
    parseFloat(saleSummary?.total_due ?? "0") + parseFloat(birdSummary?.total_due ?? "0");
  const outstandingLoading = saleSummaryLoading || birdSummaryLoading;
  const outstandingError = saleSummaryError || birdSummaryError;

  const periodLoading = byProductLineLoading || gradeDistributionLoading;
  const periodError = byProductLineError || gradeDistributionError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <DayRangeToggle value={days} onValueChange={setDays} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          label="Total revenue"
          value={formatMoney(totalRevenue)}
          icon={Wallet}
          isLoading={periodLoading}
          isError={periodError}
        />
        <KPICard
          label="Birds sold"
          value={birdsSold}
          icon={Bird}
          isLoading={periodLoading}
          isError={periodError}
        />
        <KPICard
          label="Outstanding due"
          value={formatMoney(outstandingDue)}
          icon={Receipt}
          isLoading={outstandingLoading}
          isError={outstandingError}
          hint="All time"
        />
        <KPICard
          label="Avg price/kg"
          value={formatMoney(avgPricePerKg)}
          icon={TrendingUp}
          isLoading={periodLoading}
          isError={periodError}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueByProductLineChart days={days} />
        <SalesPriceTrendChart days={days} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GradeDistributionChart days={days} />
        <TopOutstandingCustomersCard />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Bird, Receipt, TrendingUp, Wallet } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import { SalesPriceTrendChart } from "@/pages/analytics/sales-price-trend-chart";
import type { GradeDistributionRow, SalesByProductLineRow } from "@/pages/analytics/types";
import type { BirdSale, Sale } from "@/pages/sales/types";
import { RevenueByProductLineChart } from "@/pages/sales/revenue-by-product-line-chart";
import { GradeDistributionChart } from "@/pages/sales/grade-distribution-chart";
import { TopOutstandingCustomersCard } from "@/pages/sales/top-outstanding-customers-card";

export function OverviewTab() {
  const [days, setDays] = useState(30);

  const { data: byProductLine, isLoading: byProductLineLoading } = useGetData<SalesByProductLineRow[]>(
    `/analytics/sales/by-product-line?days=${days}`,
    ["analytics", "sales", "by-product-line", days]
  );
  const { data: gradeDistribution, isLoading: gradeDistributionLoading } = useGetData<GradeDistributionRow[]>(
    `/analytics/sales/grade-distribution?days=${days}`,
    ["analytics", "sales", "grade-distribution", days]
  );
  const { data: sales, isLoading: salesLoading } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"]);
  const { data: birdSales, isLoading: birdSalesLoading } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", [
    "bird-sales",
  ]);

  const totalRevenue = (byProductLine ?? []).reduce((sum, r) => sum + parseFloat(r.revenue), 0);
  const birdsSold = (gradeDistribution ?? []).reduce((sum, r) => sum + r.birds_count, 0);

  const since = Date.now() - days * 86_400_000;
  const recentBirdSales = (birdSales?.results ?? []).filter((s) => new Date(s.sale_date).getTime() >= since);
  const periodBirdRevenue = recentBirdSales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
  const periodNetWeight = recentBirdSales.reduce((sum, s) => sum + parseFloat(s.net_weight), 0);
  const avgPricePerKg = periodNetWeight > 0 ? periodBirdRevenue / periodNetWeight : 0;

  const outstandingDue =
    (sales?.results ?? []).reduce((sum, s) => sum + parseFloat(s.due_amount), 0) +
    (birdSales?.results ?? []).reduce((sum, s) => sum + parseFloat(s.due_amount), 0);

  const kpiLoading = byProductLineLoading || gradeDistributionLoading || salesLoading || birdSalesLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <DayRangeToggle value={days} onValueChange={setDays} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total revenue" value={formatMoney(totalRevenue)} icon={Wallet} isLoading={kpiLoading} />
        <KPICard label="Birds sold" value={birdsSold} icon={Bird} isLoading={kpiLoading} />
        <KPICard label="Outstanding due" value={formatMoney(outstandingDue)} icon={Receipt} isLoading={kpiLoading} />
        <KPICard label="Avg price/kg" value={formatMoney(avgPricePerKg)} icon={TrendingUp} isLoading={kpiLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueByProductLineChart days={days} />
        <SalesPriceTrendChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GradeDistributionChart days={days} />
        <TopOutstandingCustomersCard />
      </div>
    </div>
  );
}

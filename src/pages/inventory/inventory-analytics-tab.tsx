import { useState } from "react";
import { AlertCircle, AlertTriangle, Wallet } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import type { Asset, LowStockItem } from "@/pages/inventory/types";
import { bookValue } from "@/pages/inventory/asset-utils";
import { StockValueByCategoryChart } from "@/pages/inventory/stock-value-by-category-chart";
import { AssetDepreciationTrendChart } from "@/pages/inventory/asset-depreciation-trend-chart";
import { ConsumptionByCategoryChart } from "@/pages/inventory/consumption-by-category-chart";
import { WastageByCategoryChart } from "@/pages/inventory/wastage-by-category-chart";
import { StockMovementTrendChart } from "@/pages/inventory/stock-movement-trend-chart";
import { ConsumptionTrendChart } from "@/pages/inventory/consumption-trend-chart";

export function InventoryAnalyticsTab() {
  const [days, setDays] = useState(30);

  const { data: lowStockItems, isLoading: lowStockLoading } = useGetData<LowStockItem[]>(
    "/items/low-stock",
    ["items", "low-stock"]
  );
  const { data: assets, isLoading: assetsLoading } = useGetData<Paginated<Asset>>("/assets?limit=100", ["assets"]);

  const items = lowStockItems ?? [];
  const criticalCount = items.filter((i) => parseFloat(i.current_balance) <= 0).length;
  const totalBookValue = (assets?.results ?? []).reduce((sum, a) => sum + bookValue(a), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Below reorder level" value={items.length} icon={AlertTriangle} isLoading={lowStockLoading} />
        <KPICard label="Critical (out of stock)" value={criticalCount} icon={AlertCircle} isLoading={lowStockLoading} />
        <KPICard label="Total asset book value" value={formatMoney(totalBookValue)} icon={Wallet} isLoading={assetsLoading} />
      </div>

      <div className="flex justify-end">
        <DayRangeToggle value={days} onValueChange={setDays} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConsumptionByCategoryChart days={days} />
        <WastageByCategoryChart days={days} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StockValueByCategoryChart />
        <AssetDepreciationTrendChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StockMovementTrendChart />
        <ConsumptionTrendChart />
      </div>
    </div>
  );
}

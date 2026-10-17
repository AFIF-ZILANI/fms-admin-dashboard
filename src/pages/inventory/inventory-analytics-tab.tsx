import { useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeftRight, Boxes, Trash2, Wallet, Wheat } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import type { ConsumptionByCategoryRow, StockMovementTrendPoint, StockValueByCategoryRow, WastageByCategoryRow } from "@/pages/analytics/types";
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

  const { data: stockValue, isLoading: stockValueLoading, isError: stockValueError } = useGetData<StockValueByCategoryRow[]>(
    "/analytics/inventory/stock-value-by-category",
    ["analytics", "inventory-kpi", "stock-value"]
  );
  const { data: consumed, isLoading: consumedLoading, isError: consumedError } = useGetData<ConsumptionByCategoryRow[]>(
    `/analytics/inventory/consumption-by-category?days=${days}`,
    ["analytics", "inventory-kpi", "consumed", days]
  );
  const { data: wasted, isLoading: wastedLoading, isError: wastedError } = useGetData<WastageByCategoryRow[]>(
    `/analytics/inventory/wastage-by-category?days=${days}`,
    ["analytics", "inventory-kpi", "wasted", days]
  );
  const { data: movement, isLoading: movementLoading, isError: movementError } = useGetData<StockMovementTrendPoint[]>(
    `/analytics/inventory/stock-movement-trend?days=${days}`,
    ["analytics", "inventory-kpi", "movement", days]
  );
  const sumTotals = (rows?: { total: string }[]) => (rows ?? []).reduce((sum, r) => sum + Number(r.total), 0);
  const stockValueTotal = sumTotals(stockValue);
  const consumedTotal = sumTotals(consumed);
  const wastedTotal = sumTotals(wasted);
  const netMovement = (movement ?? []).reduce((sum, p) => sum + Number(p.in) - Number(p.out), 0);
  const items = lowStockItems ?? [];
  const criticalCount = items.filter((i) => parseFloat(i.current_balance) <= 0).length;
  const totalBookValue = (assets?.results ?? []).filter((a) => a.status === "ACTIVE").reduce((sum, a) => sum + bookValue(a), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Stock value on hand" value={formatMoney(stockValueTotal)} hint="at average purchase cost" icon={Boxes} isLoading={stockValueLoading} isError={stockValueError} />
        <KPICard label="Below reorder level" value={items.length} icon={AlertTriangle} isLoading={lowStockLoading} />
        <KPICard label="Out of stock" value={criticalCount} tone={criticalCount > 0 ? "critical" : undefined} icon={AlertCircle} isLoading={lowStockLoading} />
        <KPICard label="Asset book value" value={formatMoney(totalBookValue)} hint="active assets" icon={Wallet} isLoading={assetsLoading} />
        <KPICard label="Consumed" value={formatMoney(consumedTotal)} hint={`last ${days} days`} icon={Wheat} isLoading={consumedLoading} isError={consumedError} />
        <KPICard label="Wastage / expired" value={formatMoney(wastedTotal)} hint={`last ${days} days`} tone={wastedTotal > 0 ? "warning" : undefined} icon={Trash2} isLoading={wastedLoading} isError={wastedError} />
        <KPICard label="Net stock change" value={(netMovement >= 0 ? "+" : "-") + formatMoney(Math.abs(netMovement))} hint={`value in minus out, ${days} days`} icon={ArrowLeftRight} isLoading={movementLoading} isError={movementError} />
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

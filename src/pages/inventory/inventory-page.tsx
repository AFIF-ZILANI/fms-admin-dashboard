import { useState } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { ItemCatalogTab } from "@/pages/inventory/item-catalog-tab";
import { InventoryAnalyticsTab } from "@/pages/inventory/inventory-analytics-tab";
import { LowStockTab } from "@/pages/inventory/low-stock-tab";
import { CodedUnitsTab } from "@/pages/inventory/coded-units-tab";
import { AssetsTab } from "@/pages/inventory/assets-tab";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { AdjustmentsTab } from "@/pages/inventory/adjustments-tab";
import { StockLedgerTab } from "@/pages/inventory/stock-ledger-tab";
import { ConsumptionLogTab } from "@/pages/inventory/consumption-log-tab";

export function InventoryPage() {
  usePageTitle("Inventory");
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") ?? "analytics");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value ?? "analytics")}>
      <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="stock-ledger">Stock Ledger</TabsTrigger>
          <TabsTrigger value="items">Item Catalog</TabsTrigger>
          <TabsTrigger value="low-stock">Low-Stock</TabsTrigger>
          <TabsTrigger value="consumption-log">Consumption Log</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="coded-units">Coded Units</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="analytics">
        <InventoryAnalyticsTab />
      </TabsContent>
      <TabsContent value="items">
        <ItemCatalogTab onViewLowStock={() => setTab("low-stock")} />
      </TabsContent>
      <TabsContent value="low-stock">
        <LowStockTab />
      </TabsContent>
      <TabsContent value="coded-units">
        <CodedUnitsTab />
      </TabsContent>
      <TabsContent value="assets">
        <AssetsTab />
      </TabsContent>
      <TabsContent value="stock-ledger">
        <StockLedgerTab />
      </TabsContent>
      <TabsContent value="adjustments">
        <AdjustmentsTab />
      </TabsContent>
      <TabsContent value="warehouses">
        <WarehousesTab />
      </TabsContent>
      <TabsContent value="organizations">
        <OrganizationsTab />
      </TabsContent>
      <TabsContent value="consumption-log">
        <ConsumptionLogTab />
      </TabsContent>
    </Tabs>
  );
}

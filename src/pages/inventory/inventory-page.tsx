import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { ItemCatalogTab } from "@/pages/inventory/item-catalog-tab";
import { LowStockTab } from "@/pages/inventory/low-stock-tab";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { AdjustmentsTab } from "@/pages/inventory/adjustments-tab";
import { StockLedgerTab } from "@/pages/inventory/stock-ledger-tab";

export function InventoryPage() {
  usePageTitle("Inventory");
  const [tab, setTab] = useState("items");

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value ?? "items")}>
      <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="items">Item Catalog</TabsTrigger>
          <TabsTrigger value="low-stock">Low-Stock</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
          <TabsTrigger value="stock-ledger">Stock Ledger</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="items">
        <ItemCatalogTab onViewLowStock={() => setTab("low-stock")} />
      </TabsContent>
      <TabsContent value="low-stock">
        <LowStockTab />
      </TabsContent>
      <TabsContent value="adjustments">
        <AdjustmentsTab />
      </TabsContent>
      <TabsContent value="stock-ledger">
        <StockLedgerTab />
      </TabsContent>
      <TabsContent value="warehouses">
        <WarehousesTab />
      </TabsContent>
      <TabsContent value="organizations">
        <OrganizationsTab />
      </TabsContent>
    </Tabs>
  );
}

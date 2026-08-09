import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { ItemCatalogTab } from "@/pages/inventory/item-catalog-tab";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";

// ponytail: only the first 3 of docs/PRD.md §6.4's 9 sub-sections are built —
// Low-Stock, Coded Units, Assets, Stock Ledger, Adjustments, Consumption Log
// all depend on Purchases existing for realistic data. Add tabs as those ship.
export function InventoryPage() {
  usePageTitle("Inventory");

  return (
    <Tabs defaultValue="items">
      <TabsList>
        <TabsTrigger value="items">Item Catalog</TabsTrigger>
        <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        <TabsTrigger value="organizations">Organizations</TabsTrigger>
      </TabsList>
      <TabsContent value="items">
        <ItemCatalogTab />
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

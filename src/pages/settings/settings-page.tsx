import { Layers, Package, Ruler, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";
import { StockUnitProvisionCard } from "@/pages/settings/stock-unit-provision-card";
import { LookupManagerCard } from "@/pages/settings/lookup-manager-card";

// Every tab here reuses the shared component its owning page already built
// (Warehouses/Organizations from Inventory, Instruments from Payments) —
// per PRD.md §6.15, Settings hosts them, it doesn't fork its own forms.
export function SettingsPage() {
  usePageTitle("Settings");

  return (
    <Tabs defaultValue="warehouses">
      <TabsList>
        <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        <TabsTrigger value="instruments">Payment Instruments</TabsTrigger>
        <TabsTrigger value="organizations">Organizations</TabsTrigger>
        <TabsTrigger value="coded-units">Coded Units</TabsTrigger>
        <TabsTrigger value="categories-units">Categories & Units</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
      </TabsList>
      <TabsContent value="warehouses">
        <WarehousesTab />
      </TabsContent>
      <TabsContent value="instruments">
        <InstrumentsTab />
      </TabsContent>
      <TabsContent value="organizations">
        <OrganizationsTab />
      </TabsContent>
      <TabsContent value="coded-units">
        <StockUnitProvisionCard />
      </TabsContent>
      <TabsContent value="categories-units">
        <p className="mb-4 text-sm text-muted-foreground">
          Renaming FEED, MEDICINE, VACCINE, or EQUIPMENT may affect other features (feeding programs, asset
          creation, coded-unit binding) that reference those specific categories.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <LookupManagerCard title="Item Categories" singular="Item Category" endpoint="/item-categories" queryKey="item-categories" icon={Package} />
          <LookupManagerCard title="Units" singular="Unit" endpoint="/units" queryKey="units" icon={Ruler} />
          <LookupManagerCard title="Expense Categories" singular="Expense Category" endpoint="/expense-categories" queryKey="expense-categories" icon={Layers} />
          <LookupManagerCard
            title="Supplier Supply Categories"
            singular="Supplier Supply Category"
            endpoint="/supplier-supply-categories"
            queryKey="supplier-supply-categories"
            icon={Truck}
          />
        </div>
      </TabsContent>
      <TabsContent value="system">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System configuration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Nothing configurable yet — this section is a placeholder until there's a real system-level setting to
            expose (e.g. auth/roles once Phase 15 ships).
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

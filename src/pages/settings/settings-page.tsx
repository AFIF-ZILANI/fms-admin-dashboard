import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";
import { StockUnitProvisionCard } from "@/pages/settings/stock-unit-provision-card";

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { OverviewTab } from "@/pages/sales/overview-tab";
import { RegularSalesTab } from "@/pages/sales/regular-sales-tab";
import { BirdSalesTab } from "@/pages/sales/bird-sales-tab";

export function SalesPage() {
  usePageTitle("Sales");
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="birds">Bird Sales</TabsTrigger>
        <TabsTrigger value="regular">Regular Sales</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="birds">
        <BirdSalesTab />
      </TabsContent>
      <TabsContent value="regular">
        <RegularSalesTab />
      </TabsContent>
    </Tabs>
  );
}

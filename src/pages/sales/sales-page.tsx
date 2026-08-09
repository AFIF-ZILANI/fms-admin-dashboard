import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { RegularSalesTab } from "@/pages/sales/regular-sales-tab";
import { BirdSalesTab } from "@/pages/sales/bird-sales-tab";

export function SalesPage() {
  usePageTitle("Sales");

  return (
    <Tabs defaultValue="regular">
      <TabsList>
        <TabsTrigger value="regular">Regular Sales</TabsTrigger>
        <TabsTrigger value="birds">Bird Sales</TabsTrigger>
      </TabsList>
      <TabsContent value="regular">
        <RegularSalesTab />
      </TabsContent>
      <TabsContent value="birds">
        <BirdSalesTab />
      </TabsContent>
    </Tabs>
  );
}

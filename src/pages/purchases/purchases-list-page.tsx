import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { PurchasesOverviewTab } from "@/pages/purchases/purchases-overview-tab";
import { PurchaseHistoryTab } from "@/pages/purchases/purchase-history-tab";

export function PurchasesListPage() {
  usePageTitle("Purchases");
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="history">Purchase History</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <PurchasesOverviewTab />
      </TabsContent>
      <TabsContent value="history">
        <PurchaseHistoryTab />
      </TabsContent>
    </Tabs>
  );
}

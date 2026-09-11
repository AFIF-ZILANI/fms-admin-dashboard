import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { OverviewTab } from "@/pages/sales/overview-tab";
import { RegularSalesTab } from "@/pages/sales/regular-sales-tab";
import { BirdSalesTab } from "@/pages/sales/bird-sales-tab";

const TABS = ["overview", "birds", "regular"] as const;

export function SalesPage() {
  usePageTitle("Sales");
  const [searchParams, setSearchParams] = useSearchParams();
  // In the URL so a refresh, a browser-back, and "Back to sales" from a detail
  // page all return to the tab the user was on.
  const param = searchParams.get("tab");
  const tab = TABS.includes(param as (typeof TABS)[number]) ? param! : "overview";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
    >
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

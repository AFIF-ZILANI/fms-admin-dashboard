import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { OverviewTab } from "@/pages/finance/overview-tab";
import { ExpensesTab } from "@/pages/finance/expenses-tab";
import { DepreciationTab } from "@/pages/finance/depreciation-tab";
import { BatchPnlTab } from "@/pages/finance/batch-pnl-tab";
import { SharedCostsTab } from "@/pages/finance/shared-costs-tab";

// The bird-days formula itself stays v2 (system-design-arc.md §7) — see SharedCostsTab for the visibility-only queue.
export function FinancePage() {
  usePageTitle("Finance");

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
        <TabsTrigger value="shared-costs">Shared Costs</TabsTrigger>
        <TabsTrigger value="pnl">Batch P&amp;L</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpensesTab />
      </TabsContent>
      <TabsContent value="depreciation">
        <DepreciationTab />
      </TabsContent>
      <TabsContent value="shared-costs">
        <SharedCostsTab />
      </TabsContent>
      <TabsContent value="pnl">
        <BatchPnlTab />
      </TabsContent>
    </Tabs>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { OverviewTab } from "@/pages/finance/overview-tab";
import { ExpensesTab } from "@/pages/finance/expenses-tab";
import { DepreciationTab } from "@/pages/finance/depreciation-tab";
import { BatchPnlTab } from "@/pages/finance/batch-pnl-tab";

// ponytail: no "shared-period allocation queue" tab — the bird-days formula
// that would distribute SHARED_PERIOD expenses across concurrent batches is
// explicitly v2 (system-design-arc.md §7). Batch P&L already surfaces the
// unallocated total so nothing's silently hidden; add the queue once that
// formula exists.
export function FinancePage() {
  usePageTitle("Finance");

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
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
      <TabsContent value="pnl">
        <BatchPnlTab />
      </TabsContent>
    </Tabs>
  );
}

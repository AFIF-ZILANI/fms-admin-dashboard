import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/components/layout/use-page-title";
import { PaymentsTab } from "@/pages/payments/payments-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";

// ponytail: no "Outstanding Dues" tab yet — Purchases/Sales/Bird Sales list
// and detail pages already surface each record's due amount, and the Record
// Payment dialog's ref picker filters to due > 0. Add a cross-list rollup if
// browsing dues across all three types at once becomes a real workflow.
export function PaymentsPage() {
  usePageTitle("Payments");

  return (
    <Tabs defaultValue="payments">
      <TabsList>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="instruments">Instruments</TabsTrigger>
      </TabsList>
      <TabsContent value="payments">
        <PaymentsTab />
      </TabsContent>
      <TabsContent value="instruments">
        <InstrumentsTab />
      </TabsContent>
    </Tabs>
  );
}

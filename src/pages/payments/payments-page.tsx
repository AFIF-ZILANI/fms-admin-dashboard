import { SectionPage } from "@/components/layout/section-page";
import { PaymentsTab } from "@/pages/payments/payments-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";

// ponytail: no "Outstanding Dues" section yet — Purchases/Sales/Bird Sales list
// and detail pages already surface each record's due amount, and the Record
// Payment dialog's ref picker filters to due > 0. Add a cross-list rollup if
// browsing dues across all three types at once becomes a real workflow.
export function PaymentsPage() {
  return (
    <SectionPage
      title="Payments"
      sections={[
        { id: "payments", label: "Payments", content: <PaymentsTab /> },
        { id: "instruments", label: "Instruments", content: <InstrumentsTab /> },
      ]}
    />
  );
}

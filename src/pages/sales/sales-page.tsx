import { SectionPage } from "@/components/layout/section-page";
import { OverviewTab } from "@/pages/sales/overview-tab";
import { RegularSalesTab } from "@/pages/sales/regular-sales-tab";
import { BirdSalesTab } from "@/pages/sales/bird-sales-tab";
import { IncomingTab } from "@/pages/sales/incoming-tab";

// The section is in the URL (?tab=) so a refresh, a browser-back, and "Back to sales" from a detail
// page all return to where the user was.
export function SalesPage() {
  return (
    <SectionPage
      title="Sales"
      sections={[
        { id: "overview", label: "Overview", content: <OverviewTab /> },
        { id: "birds", label: "Bird sales", content: <BirdSalesTab /> },
        { id: "regular", label: "Regular sales", content: <RegularSalesTab /> },
        { id: "incoming", label: "Incoming", content: <IncomingTab /> },
      ]}
    />
  );
}

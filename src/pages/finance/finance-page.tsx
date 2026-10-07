import { SectionPage } from "@/components/layout/section-page";
import { OverviewTab } from "@/pages/finance/overview-tab";
import { ExpensesTab } from "@/pages/finance/expenses-tab";
import { DepreciationTab } from "@/pages/finance/depreciation-tab";
import { BatchPnlTab } from "@/pages/finance/batch-pnl-tab";
import { SharedCostsTab } from "@/pages/finance/shared-costs-tab";

// The bird-days formula itself stays v2 (system-design-arc.md §7) — see SharedCostsTab for the visibility-only queue.
export function FinancePage() {
  return (
    <SectionPage
      title="Finance"
      sections={[
        { id: "overview", label: "Overview", content: <OverviewTab /> },
        { id: "expenses", label: "Expenses", content: <ExpensesTab /> },
        { id: "depreciation", label: "Depreciation", content: <DepreciationTab /> },
        { id: "shared-costs", label: "Shared costs", content: <SharedCostsTab /> },
        { id: "pnl", label: "Batch P&L", content: <BatchPnlTab /> },
      ]}
    />
  );
}

import { useNavigate } from "react-router";
import { SectionPage } from "@/components/layout/section-page";
import { ItemCatalogTab } from "@/pages/inventory/item-catalog-tab";
import { InventoryAnalyticsTab } from "@/pages/inventory/inventory-analytics-tab";
import { LowStockTab } from "@/pages/inventory/low-stock-tab";
import { CodedUnitsTab } from "@/pages/inventory/coded-units-tab";
import { AssetsTab } from "@/pages/inventory/assets-tab";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { AdjustmentsTab } from "@/pages/inventory/adjustments-tab";
import { StockLedgerTab } from "@/pages/inventory/stock-ledger-tab";
import { StockAllocationTab } from "@/pages/inventory/stock-allocation-tab";
import { ConsumptionLogTab } from "@/pages/inventory/consumption-log-tab";

export function InventoryPage() {
  const navigate = useNavigate();

  return (
    <SectionPage
      title="Inventory"
      sections={[
        { id: "analytics", label: "Analytics", content: <InventoryAnalyticsTab /> },
        { id: "stock-ledger", label: "Stock ledger", content: <StockLedgerTab /> },
        {
          id: "items",
          label: "Item catalog",
          content: <ItemCatalogTab onViewLowStock={() => navigate("/inventory?tab=low-stock")} />,
        },
        { id: "low-stock", label: "Low stock", content: <LowStockTab /> },
        { id: "consumption-log", label: "Consumption log", content: <ConsumptionLogTab /> },
        { id: "assets", label: "Assets", content: <AssetsTab /> },
        { id: "adjustments", label: "Adjustments", content: <AdjustmentsTab /> },
        { id: "organizations", label: "Organizations", content: <OrganizationsTab /> },
        { id: "coded-units", label: "Coded units", content: <CodedUnitsTab /> },
        { id: "stock-allocation", label: "Stock allocation", content: <StockAllocationTab /> },
        { id: "warehouses", label: "Warehouses", content: <WarehousesTab /> },
      ]}
    />
  );
}

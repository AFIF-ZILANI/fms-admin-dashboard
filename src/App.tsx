import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ComingSoon } from "@/pages/coming-soon";
import { HousesListPage } from "@/pages/houses/houses-list-page";
import { HouseDetailPage } from "@/pages/houses/house-detail-page";
import { SuppliersListPage } from "@/pages/suppliers/suppliers-list-page";
import { SupplierDetailPage } from "@/pages/suppliers/supplier-detail-page";
import { CustomersListPage } from "@/pages/customers/customers-list-page";
import { CustomerDetailPage } from "@/pages/customers/customer-detail-page";
import { InventoryPage } from "@/pages/inventory/inventory-page";
import { AdminsListPage } from "@/pages/admins/admins-list-page";
import { BatchesListPage } from "@/pages/batches/batches-list-page";
import { BatchDetailPage } from "@/pages/batches/batch-detail-page";
import { PurchasesListPage } from "@/pages/purchases/purchases-list-page";
import { PurchaseDetailPage } from "@/pages/purchases/purchase-detail-page";
import { SalesPage } from "@/pages/sales/sales-page";
import { SaleDetailPage } from "@/pages/sales/sale-detail-page";
import { PaymentsPage } from "@/pages/payments/payments-page";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/analytics" replace />} />
        <Route path="analytics" element={<ComingSoon title="Analytics" />} />
        <Route path="batches" element={<BatchesListPage />} />
        <Route path="batches/:id" element={<BatchDetailPage />} />
        <Route path="houses" element={<HousesListPage />} />
        <Route path="houses/:id" element={<HouseDetailPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="sales/:id" element={<SaleDetailPage />} />
        <Route path="purchases" element={<PurchasesListPage />} />
        <Route path="purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="finance" element={<ComingSoon title="Finance" />} />
        <Route path="employees" element={<ComingSoon title="Employees" />} />
        <Route path="admins" element={<AdminsListPage />} />
        <Route path="alerts" element={<ComingSoon title="Alerts" />} />
        <Route path="audit-log" element={<ComingSoon title="Audit Log" />} />
        <Route path="settings" element={<ComingSoon title="Settings" />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
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
import { PurchaseCreatePage } from "@/pages/purchases/purchase-create-page";
import { PurchaseDetailPage } from "@/pages/purchases/purchase-detail-page";
import { SalesPage } from "@/pages/sales/sales-page";
import { SaleDetailPage } from "@/pages/sales/sale-detail-page";
import { BirdSaleDetailPage } from "@/pages/sales/bird-sale-detail-page";
import { PaymentsPage } from "@/pages/payments/payments-page";
import { FinancePage } from "@/pages/finance/finance-page";
import { EmployeesListPage } from "@/pages/employees/employees-list-page";
import { EmployeeDetailPage } from "@/pages/employees/employee-detail-page";
import { AnalyticsPage } from "@/pages/analytics/analytics-page";
import { AlertsPage } from "@/pages/alerts/alerts-page";
import { AuditLogPage } from "@/pages/audit-log/audit-log-page";
import { SettingsPage } from "@/pages/settings/settings-page";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/analytics" replace />} />
        <Route path="analytics" element={<AnalyticsPage />} />
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
        <Route path="sales/birds/:id" element={<BirdSaleDetailPage />} />
        <Route path="purchases" element={<PurchasesListPage />} />
        <Route path="purchases/new" element={<PurchaseCreatePage />} />
        <Route path="purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="employees" element={<EmployeesListPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="admins" element={<AdminsListPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

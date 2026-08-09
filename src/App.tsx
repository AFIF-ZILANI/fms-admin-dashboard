import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ComingSoon } from "@/pages/coming-soon";
import { HousesListPage } from "@/pages/houses/houses-list-page";
import { HouseDetailPage } from "@/pages/houses/house-detail-page";
import { SuppliersListPage } from "@/pages/suppliers/suppliers-list-page";
import { SupplierDetailPage } from "@/pages/suppliers/supplier-detail-page";
import { CustomersListPage } from "@/pages/customers/customers-list-page";
import { CustomerDetailPage } from "@/pages/customers/customer-detail-page";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/analytics" replace />} />
        <Route path="analytics" element={<ComingSoon title="Analytics" />} />
        <Route path="batches" element={<ComingSoon title="Batches" />} />
        <Route path="houses" element={<HousesListPage />} />
        <Route path="houses/:id" element={<HouseDetailPage />} />
        <Route path="inventory" element={<ComingSoon title="Inventory" />} />
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="customers" element={<CustomersListPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="sales" element={<ComingSoon title="Sales" />} />
        <Route path="purchases" element={<ComingSoon title="Purchases" />} />
        <Route path="payments" element={<ComingSoon title="Payments" />} />
        <Route path="finance" element={<ComingSoon title="Finance" />} />
        <Route path="employees" element={<ComingSoon title="Employees" />} />
        <Route path="admins" element={<ComingSoon title="Admins" />} />
        <Route path="alerts" element={<ComingSoon title="Alerts" />} />
        <Route path="audit-log" element={<ComingSoon title="Audit Log" />} />
        <Route path="settings" element={<ComingSoon title="Settings" />} />
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Route>
    </Routes>
  );
}

export default App;

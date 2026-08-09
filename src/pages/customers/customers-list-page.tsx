import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Plus, Star, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import type { Customer } from "@/pages/customers/types";
import { CustomerFormDialog } from "@/pages/customers/customer-form-dialog";

export function CustomersListPage() {
  usePageTitle("Customers");
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  // limit=100 (the API max) rather than paging — small enough customer counts
  // in practice that this doubles as "fetch everything" for both the table and the stats below.
  const { data, isLoading } = useGetData<Paginated<Customer>>("/customers?limit=100", ["customers"]);

  const customers = data?.results ?? [];
  const totalCustomers = data?.total ?? customers.length;
  const activeCustomers = customers.filter((c) => c.is_active).length;
  const inactiveCustomers = customers.length - activeCustomers;

  const columns: Column<Customer>[] = [
    { key: "name", header: "Name", render: (c) => <span className="font-medium">{c.profile.name}</span> },
    { key: "company", header: "Company", render: (c) => c.company ?? "—" },
    { key: "mobile", header: "Mobile", render: (c) => c.profile.mobile },
    {
      key: "rating",
      header: "Rating",
      render: (c) =>
        c.rating ? (
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-warning text-warning" />
            {c.rating.toFixed(1)}
          </span>
        ) : (
          "—"
        ),
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => {
        const { tone, label } = activeStatus(c.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Total customers" value={totalCustomers} icon={Users} isLoading={isLoading} />
        <KPICard label="Active" value={activeCustomers} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Inactive" value={inactiveCustomers} icon={XCircle} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus />
          Add customer
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={customers}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        empty={{
          icon: Users,
          title: "No customers yet",
          description: "Add your first customer to start recording sales.",
          action: { label: "Add customer", onClick: () => setFormOpen(true) },
        }}
      />

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

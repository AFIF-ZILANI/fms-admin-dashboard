import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Customer } from "@/pages/customers/types";
import type { BirdSale, Sale } from "@/pages/sales/types";

const TOP_N = 5;

export function TopOutstandingCustomersCard() {
  const { data: sales, isLoading: salesLoading } = useGetData<Paginated<Sale>>("/sales?limit=100", ["sales"]);
  const { data: birdSales, isLoading: birdSalesLoading } = useGetData<Paginated<BirdSale>>("/bird-sales?limit=100", [
    "bird-sales",
  ]);
  const { data: customers, isLoading: customersLoading } = useGetData<Paginated<Customer>>("/customers?limit=100", [
    "customers",
  ]);
  const isLoading = salesLoading || birdSalesLoading || customersLoading;

  const dueByCustomer = new Map<string, number>();
  for (const s of sales?.results ?? []) {
    if (!s.customer_id) continue;
    dueByCustomer.set(s.customer_id, (dueByCustomer.get(s.customer_id) ?? 0) + parseFloat(s.due_amount));
  }
  for (const s of birdSales?.results ?? []) {
    if (!s.customer_id) continue;
    dueByCustomer.set(s.customer_id, (dueByCustomer.get(s.customer_id) ?? 0) + parseFloat(s.due_amount));
  }

  const ranked = Array.from(dueByCustomer.entries())
    .filter(([, due]) => due > 0)
    .map(([customerId, due]) => ({
      customerId,
      due,
      name: customers?.results.find((c) => c.id === customerId)?.profile.name ?? "Unknown customer",
    }))
    .sort((a, b) => b.due - a.due)
    .slice(0, TOP_N);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top outstanding customers</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && ranked.length === 0 && (
          <EmptyState icon={Users} title="No outstanding balances" description="Every customer is paid up." />
        )}
        {!isLoading && ranked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ranked.map((r) => (
              <li key={r.customerId} className="flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span className="font-medium tabular-nums">{formatMoney(r.due)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

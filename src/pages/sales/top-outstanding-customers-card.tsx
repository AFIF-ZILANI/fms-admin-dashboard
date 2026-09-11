import { AlertCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

type TopOutstandingRow = { customer_id: string; customer_name: string; due: string };

const TOP_N = 5;

/** Ranked server-side: summing this client-side meant fetching sales, bird
 * sales and payments at limit=100 each and joining them here, so any customer
 * whose unpaid sales fell off those pages silently dropped out of the ranking. */
export function TopOutstandingCustomersCard() {
  const { data, isLoading, isError } = useGetData<TopOutstandingRow[]>(
    `/analytics/sales/top-outstanding-customers?limit=${TOP_N}`,
    ["analytics", "sales", "top-outstanding-customers", TOP_N]
  );
  const ranked = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top outstanding customers</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this data" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && ranked.length === 0 && (
          <EmptyState icon={Users} title="No outstanding balances" description="Every customer is paid up." />
        )}
        {!isLoading && !isError && ranked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ranked.map((r) => (
              <li key={r.customer_id} className="flex items-center justify-between text-sm">
                <span>{r.customer_name}</span>
                <span className="font-medium tabular-nums">{formatMoney(r.due)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

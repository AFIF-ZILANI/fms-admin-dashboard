import { AlertCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Supplier } from "@/pages/suppliers/types";
import type { Purchase } from "@/pages/purchases/types";
import { useOutstanding } from "@/pages/sales/use-outstanding";

const TOP_N = 5;

export function TopOutstandingSuppliersCard() {
  const {
    data: purchases,
    isLoading: purchasesLoading,
    isError: purchasesError,
  } = useGetData<Paginated<Purchase>>("/purchases?limit=100", ["purchases"]);
  const {
    data: suppliers,
    isLoading: suppliersLoading,
    isError: suppliersError,
  } = useGetData<Paginated<Supplier>>("/suppliers?limit=100", ["suppliers"]);
  const { trueAmounts, isLoading: outstandingLoading } = useOutstanding("PURCHASE");
  const isLoading = purchasesLoading || suppliersLoading || outstandingLoading;
  const isError = purchasesError || suppliersError;

  const dueBySupplier = new Map<string, number>();
  for (const p of purchases?.results ?? []) {
    if (!p.supplier_id) continue;
    const due = parseFloat(trueAmounts(p.id, p.paid_amount, p.due_amount).due);
    dueBySupplier.set(p.supplier_id, (dueBySupplier.get(p.supplier_id) ?? 0) + due);
  }

  const ranked = Array.from(dueBySupplier.entries())
    .filter(([, due]) => due > 0)
    .map(([supplierId, due]) => ({
      supplierId,
      due,
      name: suppliers?.results.find((s) => s.id === supplierId)?.profile.name ?? "Unknown supplier",
    }))
    .sort((a, b) => b.due - a.due)
    .slice(0, TOP_N);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top outstanding suppliers</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this data" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && ranked.length === 0 && (
          <EmptyState icon={Users} title="No outstanding balances" description="Every supplier is paid up." />
        )}
        {!isLoading && !isError && ranked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ranked.map((r) => (
              <li key={r.supplierId} className="flex items-center justify-between text-sm">
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

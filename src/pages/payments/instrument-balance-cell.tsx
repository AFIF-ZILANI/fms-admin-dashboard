import { useGetData } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { InstrumentBalance } from "@/pages/payments/types";

export function InstrumentBalanceCell({ instrumentId }: { instrumentId: string }) {
  const { data, isLoading } = useGetData<InstrumentBalance>(`/payment-instruments/${instrumentId}/balance`, [
    "payment-instruments",
    instrumentId,
    "balance",
  ]);
  if (isLoading || !data) return <span className="text-muted-foreground">…</span>;
  return <span>{formatMoney(data.balance)}</span>;
}

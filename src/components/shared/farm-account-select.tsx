import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import type { PaymentInstrument } from "@/pages/payments/types";

type FarmAccountSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

/**
 * Picks one of the farm's own active accounts (owner ADMIN): where money was paid from or received into.
 * Money recorded as paid when a sale or purchase is created must name one, so the cash lands in a
 * balance and in the cash position.
 */
export function FarmAccountSelect({ id, value, onChange, invalid }: FarmAccountSelectProps) {
  const { data } = useGetData<Paginated<PaymentInstrument>>(
    "/payment-instruments?limit=100&is_active=true",
    ["payment-instruments"],
  );
  const accounts = (data?.results ?? []).filter((i) => i.owner_type === "ADMIN");
  const label = (i: PaymentInstrument) => `${i.label} (${humanizeEnum(i.type)})`;

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
          <SelectValue>
            {(v: string) => {
              const found = accounts.find((a) => a.id === v);
              return found ? label(found) : "Select an account";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {label(a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {accounts.length === 0 && (
        <p className="text-xs text-destructive">No active farm account yet — add one under Payments first.</p>
      )}
    </div>
  );
}

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetData } from "@/lib/api";
import type { LowStockItem } from "@/pages/inventory/types";

type ReorderSuggestionsPanelProps = { onRecordPurchase: () => void };

/** PRD §6.8: "A panel or banner on this page (not a separate page)... since
 * Purchases is where that signal gets acted on." Reuses the same
 * GET /items/low-stock endpoint the Inventory page's Low-Stock tab already
 * uses -- this is a compact, actionable summary of it, not a duplicate
 * table. Renders nothing when there's nothing below reorder level. */
export function ReorderSuggestionsPanel({ onRecordPurchase }: ReorderSuggestionsPanelProps) {
  const { data } = useGetData<LowStockItem[]>("/items/low-stock", ["items", "low-stock"]);
  const items = data ?? [];

  if (items.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5 text-base text-warning">
          <AlertTriangle className="size-4" />
          {items.length} item{items.length === 1 ? "" : "s"} below reorder level
        </CardTitle>
        <Button size="sm" onClick={onRecordPurchase}>
          Record purchase
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between">
              <span>{item.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {item.current_balance} / {item.reorder_level ?? "—"} reorder level
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

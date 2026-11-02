import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useGetData } from "@/lib/api";
import type { LowStockItem } from "@/pages/inventory/types";

/** PRD §6.8: the reorder signal surfaces where it gets acted on. A one-line ribbon here; the full
 * list (with a purchase action per item) lives at /purchases/low-stock. Renders nothing when
 * there's nothing below reorder level. */
export function ReorderSuggestionsPanel() {
  const { data } = useGetData<LowStockItem[]>("/items/low-stock", ["items", "low-stock"]);
  const count = data?.length ?? 0;

  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border-l-4 border-warning bg-warning/10 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-medium text-warning">
        <AlertTriangle className="size-4" />
        {count} item{count === 1 ? "" : "s"} below reorder level
      </span>
      <Link to="/purchases/low-stock" className="flex items-center gap-1 font-medium text-warning hover:underline">
        View all
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

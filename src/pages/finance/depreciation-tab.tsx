import { TrendingDown } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { AssetDepreciation } from "@/pages/finance/types";

// Read-only — rows are only ever written by BatchService.close()'s
// depreciation trigger, never posted from the UI (asset-depreciation.service.ts).
export function DepreciationTab() {
  const { data, isLoading } = useGetData<Paginated<AssetDepreciation>>("/asset-depreciations?limit=100", [
    "asset-depreciations",
  ]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const batchCode = (id: string) => batches?.results.find((b) => b.id === id)?.batch_code ?? "—";

  const depreciations = data?.results ?? [];

  const columns: Column<AssetDepreciation>[] = [
    { key: "date", header: "Computed", render: (d) => new Date(d.computed_at).toLocaleDateString() },
    { key: "asset", header: "Asset", render: (d) => d.asset.name },
    { key: "batch", header: "Batch", render: (d) => batchCode(d.batch_id) },
    { key: "purchase_cost", header: "Purchase cost", render: (d) => formatMoney(d.asset.purchase_cost), numeric: true },
    { key: "useful_life", header: "Useful life (batches)", render: (d) => d.asset.useful_life_batches, numeric: true },
    { key: "amount", header: "Amount", render: (d) => formatMoney(d.amount), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Depreciation rows are computed automatically when a batch closes — one per asset, per batch. Nothing to
        record here.
      </p>
      <DataTable
        columns={columns}
        rows={depreciations}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        empty={{
          icon: TrendingDown,
          title: "No depreciation recorded yet",
          description: "Rows appear here once assets exist and a batch closes.",
        }}
      />
    </div>
  );
}

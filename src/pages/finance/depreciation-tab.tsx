import { useState } from "react";
import { TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Batch } from "@/pages/batches/types";
import type { AssetDepreciation, FinanceAsset } from "@/pages/finance/types";

// Read-only — rows are only ever written by BatchService.close()'s
// depreciation trigger, never posted from the UI (asset-depreciation.service.ts).
export function DepreciationTab() {
  const [assetId, setAssetId] = useState("ALL");
  const [batchId, setBatchId] = useState("ALL");

  const query = new URLSearchParams({ limit: "100" });
  if (assetId !== "ALL") query.set("asset_id", assetId);
  if (batchId !== "ALL") query.set("batch_id", batchId);

  const { data, isLoading } = useGetData<Paginated<AssetDepreciation>>(`/asset-depreciations?${query}`, [
    "asset-depreciations",
    assetId,
    batchId,
  ]);
  const { data: batches } = useGetData<Paginated<Batch>>("/batches?limit=100", ["batches"]);
  const { data: assets } = useGetData<Paginated<FinanceAsset>>("/assets?limit=100", ["assets"]);
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="depreciation-asset-filter">Asset</Label>
          <Select value={assetId} onValueChange={(v) => setAssetId(v ?? "ALL")}>
            <SelectTrigger id="depreciation-asset-filter" className="w-48">
              <SelectValue>
                {(v: string) => (v === "ALL" ? "All assets" : assets?.results.find((a) => a.id === v)?.name ?? "—")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All assets</SelectItem>
              {(assets?.results ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="depreciation-batch-filter">Batch</Label>
          <Select value={batchId} onValueChange={(v) => setBatchId(v ?? "ALL")}>
            <SelectTrigger id="depreciation-batch-filter" className="w-40">
              <SelectValue>
                {(v: string) => (v === "ALL" ? "All batches" : batches?.results.find((b) => b.id === v)?.batch_code ?? "—")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All batches</SelectItem>
              {(batches?.results ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batch_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(assetId !== "ALL" || batchId !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssetId("ALL");
              setBatchId("ALL");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
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

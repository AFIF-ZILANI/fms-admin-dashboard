import { useState } from "react";
import { Boxes, CheckCircle2, Hourglass, Percent, Plus, Receipt, Wallet } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ASSET_STATUS_TONE } from "@/components/shared/status-tone";
import { Button } from "@/components/ui/button";
import { useGetData, type Paginated } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import { AssetCreateDialog } from "@/pages/inventory/asset-create-dialog";
import { AssetDetailSheet } from "@/pages/inventory/asset-detail-sheet";
import { bookValue } from "@/pages/inventory/asset-utils";
import type { Asset } from "@/pages/inventory/types";

export function AssetsTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const { data, isLoading } = useGetData<Paginated<Asset>>("/assets?limit=100", ["assets"]);
  const assets = data?.results ?? [];

  const active = assets.filter((a) => a.status === "ACTIVE");
  const activeCount = active.length;
  const totalCost = active.reduce((sum, a) => sum + parseFloat(a.purchase_cost), 0);
  const totalBookValue = active.reduce((sum, a) => sum + bookValue(a), 0);
  const depreciatedPct = totalCost > 0 ? ((totalCost - totalBookValue) / totalCost) * 100 : null;
  // Depreciation is one row per batch, so batches left = useful life - rows booked so far.
  const batchesLeft = (a: Asset) => Math.max(0, a.useful_life_batches - (a.depreciations ?? []).length);
  const nearingEnd = active.filter((a) => batchesLeft(a) <= 1).length;
  const avgLeft = active.length ? active.reduce((sum, a) => sum + batchesLeft(a), 0) / active.length : null;

  const columns: Column<Asset>[] = [
    { key: "name", header: "Name", render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "cost", header: "Purchase cost", render: (a) => formatMoney(a.purchase_cost), numeric: true },
    { key: "useful_life", header: "Useful life", render: (a) => `${a.useful_life_batches} batches`, numeric: true },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge tone={ASSET_STATUS_TONE[a.status]} label={humanizeEnum(a.status)} />,
    },
    { key: "book_value", header: "Book value", render: (a) => formatMoney(bookValue(a)), numeric: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Add asset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Active assets" value={activeCount} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Purchase cost" value={formatMoney(totalCost)} hint="active assets" icon={Receipt} isLoading={isLoading} />
        <KPICard label="Book value" value={formatMoney(totalBookValue)} hint="what they're worth now" icon={Wallet} isLoading={isLoading} />
        <KPICard label="Depreciated" value={depreciatedPct === null ? "—" : `${depreciatedPct.toFixed(0)}%`} hint="of purchase cost written off" icon={Percent} isLoading={isLoading} />
        <KPICard label="Nearing end of life" value={nearingEnd} hint="one batch or less left" tone={nearingEnd > 0 ? "warning" : undefined} icon={Hourglass} isLoading={isLoading} />
        <KPICard label="Avg batches left" value={avgLeft === null ? "—" : avgLeft.toFixed(1)} hint="of useful life" icon={Boxes} isLoading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        rows={assets}
        totalCount={data?.total}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        onRowClick={(a) => setSelectedAssetId(a.id)}
        empty={{
          icon: Boxes,
          title: "No assets yet",
          description: "Register equipment as an asset to track its depreciation.",
          action: { label: "Add asset", onClick: () => setCreateOpen(true) },
        }}
      />

      <AssetCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AssetDetailSheet assetId={selectedAssetId} onOpenChange={(open) => !open && setSelectedAssetId(null)} />
    </div>
  );
}

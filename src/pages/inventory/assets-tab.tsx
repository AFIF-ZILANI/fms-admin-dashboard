import { useState } from "react";
import { Boxes, CheckCircle2, Plus, Wallet, XCircle } from "lucide-react";
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

  const activeCount = assets.filter((a) => a.status === "ACTIVE").length;
  const retiredOrDisposedCount = assets.length - activeCount;
  const totalBookValue = assets.reduce((sum, a) => sum + bookValue(a), 0);

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
        <KPICard label="Active" value={activeCount} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Retired / disposed" value={retiredOrDisposedCount} icon={XCircle} isLoading={isLoading} />
        <KPICard label="Total book value" value={formatMoney(totalBookValue)} icon={Wallet} isLoading={isLoading} />
      </div>

      <DataTable
        columns={columns}
        rows={assets}
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

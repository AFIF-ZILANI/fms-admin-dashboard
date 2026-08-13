import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, usePatchData } from "@/lib/api";
import { formatMoney, humanizeEnum } from "@/lib/utils";
import type { Asset, AssetDepreciation, AssetStatus } from "@/pages/inventory/types";
import { History } from "lucide-react";

const STATUS_TONE: Record<AssetStatus, Tone> = { ACTIVE: "success", RETIRED: "neutral", DISPOSED: "neutral" };

type AssetDetailSheetProps = {
  assetId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function AssetDetailSheet({ assetId, onOpenChange }: AssetDetailSheetProps) {
  const { data: asset } = useGetData<Asset>(`/assets/${assetId}`, ["assets", assetId ?? ""], {
    enabled: !!assetId,
  });

  const setStatus = usePatchData<Asset, { status: AssetStatus }>(
    () => `/assets/${assetId}/status`,
    ["assets"]
  );

  const handleStatus = (status: AssetStatus) => {
    setStatus.mutate(
      { status },
      {
        onSuccess: () => toast.success(`Asset ${status.toLowerCase()}`),
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const depreciationColumns: Column<AssetDepreciation>[] = [
    { key: "batch", header: "Batch", render: (d) => d.batch?.batch_code ?? "—" },
    { key: "amount", header: "Amount", render: (d) => formatMoney(d.amount), numeric: true },
    { key: "computed_at", header: "Computed", render: (d) => new Date(d.computed_at).toLocaleDateString() },
  ];

  return (
    <Sheet open={!!assetId} onOpenChange={onOpenChange}>
      {asset && (
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{asset.name}</SheetTitle>
            <SheetDescription>{asset.stock_unit?.code}</SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2">
            <StatusBadge tone={STATUS_TONE[asset.status]} label={humanizeEnum(asset.status)} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Purchase cost</p>
              <p>{formatMoney(asset.purchase_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Purchase date</p>
              <p>{new Date(asset.purchase_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Useful life</p>
              <p>{asset.useful_life_batches} batches</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">House</p>
              <p>{asset.stock_unit?.house?.name ?? "—"}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Depreciation history</p>
            <DataTable
              columns={depreciationColumns}
              rows={asset.depreciations ?? []}
              rowKey={(d) => d.id}
              empty={{ icon: History, title: "No depreciation computed yet", description: "This runs automatically when a batch that used this asset closes." }}
            />
          </div>

          {asset.status === "ACTIVE" && (
            <SheetFooter>
              <Button variant="outline" onClick={() => handleStatus("RETIRED")} disabled={setStatus.isPending}>
                Retire
              </Button>
              <Button variant="destructive" onClick={() => handleStatus("DISPOSED")} disabled={setStatus.isPending}>
                Dispose
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      )}
    </Sheet>
  );
}

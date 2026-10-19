import { useState } from "react";
import { Link } from "react-router";
import { TrendingDown, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Asset } from "@/pages/inventory/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
import { cn, formatDate, formatMoney, humanizeEnum } from "@/lib/utils";
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
    <div className="flex flex-col gap-6">
      <AssetRegister />
      <h3 className="-mb-2 text-base font-semibold">Depreciation by batch</h3>
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
        totalCount={data?.total}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        empty={{
          icon: TrendingDown,
          title: "No depreciation recorded yet",
          description: "Rows appear here once assets exist and a batch closes.",
        }}
      />
    </div>
    </div>
  );
}

const ASSET_TONE = { ACTIVE: "success", RETIRED: "neutral", DISPOSED: "neutral" } as const;

/** Each piece of equipment: what it cost, how much of it the batches have used up, and what's left. */
function AssetRegister() {
  const { data, isLoading } = useGetData<Paginated<Asset>>("/assets?limit=100", ["assets", "register"]);
  const rows = (data?.results ?? []).map((a) => {
    const cost = parseFloat(a.purchase_cost);
    const used = (a.depreciations ?? []).reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const batches = a.depreciations?.length ?? 0;
    return { ...a, cost, used, left: Math.max(0, cost - used), batches, batchesLeft: Math.max(0, a.useful_life_batches - batches) };
  });
  const totals = rows.reduce((t, r) => ({ cost: t.cost + r.cost, used: t.used + r.used, left: t.left + (r.status === "ACTIVE" ? r.left : 0) }), { cost: 0, used: 0, left: 0 });

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "name",
      header: "Asset",
      render: (a) => (
        <span className="flex flex-col">
          <span className="font-medium">{a.name}</span>
          <span className="text-xs text-muted-foreground">Bought {formatDate(a.purchase_date)}</span>
        </span>
      ),
      sortValue: (a) => a.name,
    },
    { key: "status", header: "Status", render: (a) => <StatusBadge tone={ASSET_TONE[a.status]} label={humanizeEnum(a.status)} /> },
    { key: "cost", header: "Cost", render: (a) => formatMoney(a.cost), numeric: true, sortValue: (a) => a.cost },
    {
      key: "life",
      header: "Batches used",
      render: (a) => (
        <span className="flex flex-col items-end gap-1">
          <span>
            {a.batches} of {a.useful_life_batches}
          </span>
          <span className="h-1.5 w-20 rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, (a.batches / a.useful_life_batches) * 100)}%` }} />
          </span>
        </span>
      ),
      numeric: true,
      sortValue: (a) => a.batches / a.useful_life_batches,
    },
    { key: "used", header: "Charged to batches", render: (a) => formatMoney(a.used), numeric: true, sortValue: (a) => a.used },
    {
      key: "left",
      header: "Value left",
      render: (a) => <span className={cn("font-medium", a.status !== "ACTIVE" && "text-muted-foreground")}>{formatMoney(a.left)}</span>,
      numeric: true,
      sortValue: (a) => a.left,
    },
    {
      key: "per_batch",
      header: "Per batch",
      render: (a) => formatMoney(a.cost / a.useful_life_batches),
      numeric: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <KPICard label="Equipment cost" value={formatMoney(totals.cost)} icon={Wrench} isLoading={isLoading} hint={`${rows.length} asset${rows.length === 1 ? "" : "s"}`} />
        <KPICard label="Charged to batches" value={formatMoney(totals.used)} icon={TrendingDown} isLoading={isLoading} hint="Through depreciation at batch close" />
        <KPICard label="Value left in use" value={formatMoney(totals.left)} icon={Wrench} isLoading={isLoading} hint="Active assets only" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Asset register</CardTitle>
            <CardDescription>
              Each asset is charged cost ÷ useful life to every batch that uses it, when that batch closes.
            </CardDescription>
          </div>
          <Link to="/inventory?tab=assets" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Manage assets
          </Link>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            isLoading={isLoading}
            empty={{ icon: Wrench, title: "No assets registered", description: "Register equipment from Inventory, Assets." }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

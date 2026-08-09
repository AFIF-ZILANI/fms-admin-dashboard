import { useNavigate } from "react-router";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData } from "@/lib/api";
import type { Batch } from "@/pages/batches/types";
import type { BatchPerformance } from "@/pages/analytics/types";

// One row per batch, each with its own fetch — GET /analytics/batches/:id/performance
// has no bulk variant, and batch counts on a farm this size stay small
// enough that N requests beats building a bulk endpoint for it.
export function BatchPerformanceRow({ batch }: { batch: Batch }) {
  const navigate = useNavigate();
  const { data, isLoading } = useGetData<BatchPerformance>(`/analytics/batches/${batch.id}/performance`, [
    "analytics",
    "performance",
    batch.id,
  ]);

  if (isLoading || !data) {
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      </TableRow>
    );
  }

  const mortalityPercent = (data.cumulative_mortality_rate * 100).toFixed(1);
  const mortalityTone = data.cumulative_mortality_rate > 0.05 ? "critical" : data.cumulative_mortality_rate > 0.02 ? "warning" : "success";

  return (
    <TableRow className="cursor-pointer" onClick={() => navigate(`/batches/${batch.id}`)}>
      <TableCell className="font-medium">{batch.batch_code}</TableCell>
      <TableCell className="text-right tabular-nums">{data.age_days}d</TableCell>
      <TableCell className="text-right tabular-nums">
        {data.live_count} / {data.initial_chick_count}
      </TableCell>
      <TableCell className="text-right">
        <StatusBadge tone={mortalityTone} label={`${mortalityPercent}%`} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {data.latest_average_weight_grams ? `${data.latest_average_weight_grams} g` : "—"}
      </TableCell>
      <TableCell>
        {data.expected_selling_date ? new Date(data.expected_selling_date).toLocaleDateString() : "—"}
      </TableCell>
    </TableRow>
  );
}

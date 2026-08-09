import { useNavigate } from "react-router";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Batch } from "@/pages/batches/types";
import type { BatchPerformance } from "@/pages/analytics/types";

export function BatchPerformanceRow({ batch, performance }: { batch: Batch; performance: BatchPerformance }) {
  const navigate = useNavigate();
  const mortalityPercent = (performance.cumulative_mortality_rate * 100).toFixed(1);
  const mortalityTone =
    performance.cumulative_mortality_rate > 0.05
      ? "critical"
      : performance.cumulative_mortality_rate > 0.02
        ? "warning"
        : "success";

  return (
    <TableRow className="cursor-pointer" onClick={() => navigate(`/batches/${batch.id}`)}>
      <TableCell className="font-medium">{batch.batch_code}</TableCell>
      <TableCell className="text-right tabular-nums">{performance.age_days}d</TableCell>
      <TableCell className="text-right tabular-nums">
        {performance.live_count} / {performance.initial_chick_count}
      </TableCell>
      <TableCell className="text-right">
        <StatusBadge tone={mortalityTone} label={`${mortalityPercent}%`} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {performance.latest_average_weight_grams ? `${performance.latest_average_weight_grams} g` : "—"}
      </TableCell>
      <TableCell>
        {performance.expected_selling_date ? new Date(performance.expected_selling_date).toLocaleDateString() : "—"}
      </TableCell>
    </TableRow>
  );
}

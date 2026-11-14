import { useGetData, type Paginated } from "@/lib/api";
import type { WeightRecord } from "@/pages/batches/types";

/** The chicks' start weight (g): the batch's Day-1 weight record, written when the batch is created.
 * Shares the weight tab's query, so it costs no extra request.
 * ponytail: the earliest of the latest 100 samples; a batch with more than 100 would lose it, page then. */
export function useStartWeight(batchId: string) {
  const { data, isLoading } = useGetData<Paginated<WeightRecord>>(
    `/weight-records?batch_id=${batchId}&limit=100`,
    ["weight-records", batchId],
  );
  const first = data?.results.reduce<WeightRecord | undefined>((a, w) => (!a || w.date < a.date ? w : a), undefined);
  return { grams: first ? parseFloat(first.average_wt_grams) : undefined, isLoading };
}

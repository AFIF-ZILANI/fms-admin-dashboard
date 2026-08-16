import { AlertCircle, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle, SINGLE_SERIES_STROKE } from "@/pages/analytics/chart-theme";
import type { Employee } from "@/pages/employees/types";

const BUCKETS = ["Unrated", "1–2 ★", "2–3 ★", "3–4 ★", "4–5 ★"] as const;

/** rating is 0 (not null) until an owner sets one -- the rest of the app
 * already treats 0 as "no rating" via a falsy check (see the employees
 * list/detail pages' `e.rating ? ... : "—"`), so bucketing follows the
 * same convention. */
function bucketFor(rating: number | null): (typeof BUCKETS)[number] {
  if (!rating) return "Unrated";
  if (rating <= 2) return "1–2 ★";
  if (rating <= 3) return "2–3 ★";
  if (rating <= 4) return "3–4 ★";
  return "4–5 ★";
}

export function RatingDistributionChart() {
  const { data, isLoading, isError } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const employees = data?.results ?? [];

  const counts = new Map<string, number>();
  for (const e of employees) {
    const bucket = bucketFor(e.rating);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const rows = BUCKETS.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 })).filter((r) => r.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rating distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton style={{ height: CHART_HEIGHT }} className="w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this chart" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState icon={BarChart3} title="No employees yet" description="Add your first employee." />
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="bucket" {...chartAxisProps} />
              <YAxis allowDecimals={false} {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} />
              <Bar dataKey="count" name="Employees" fill={SINGLE_SERIES_STROKE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

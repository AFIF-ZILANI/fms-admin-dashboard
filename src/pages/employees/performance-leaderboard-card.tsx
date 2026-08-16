import { useState } from "react";
import { AlertCircle, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { DayRangeToggle } from "@/pages/analytics/day-range-toggle";
import type { Employee, PerformanceScoreEntry } from "@/pages/employees/types";

const TOP_N = 5;

export function PerformanceLeaderboardCard() {
  const [days, setDays] = useState(30);

  const {
    data: entries,
    isLoading: entriesLoading,
    isError: entriesError,
  } = useGetData<Paginated<PerformanceScoreEntry>>("/performance-score-entries?limit=100", ["performance-score-entries"]);
  const {
    data: employees,
    isLoading: employeesLoading,
    isError: employeesError,
  } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const isLoading = entriesLoading || employeesLoading;
  const isError = entriesError || employeesError;

  const since = Date.now() - days * 86_400_000;
  const sumByEmployee = new Map<string, number>();
  for (const e of entries?.results ?? []) {
    if (new Date(e.date).getTime() < since) continue;
    sumByEmployee.set(e.employee_id, (sumByEmployee.get(e.employee_id) ?? 0) + e.points);
  }

  const ranked = Array.from(sumByEmployee.entries())
    .map(([employeeId, sum]) => ({
      employeeId,
      sum,
      name: employees?.results.find((emp) => emp.id === employeeId)?.profile.name ?? "Unknown employee",
    }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, TOP_N);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Performance leaderboard</CardTitle>
        <DayRangeToggle value={days} onValueChange={setDays} />
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && isError && (
          <EmptyState icon={AlertCircle} title="Couldn't load this data" description="Try refreshing the page." />
        )}
        {!isLoading && !isError && ranked.length === 0 && (
          <EmptyState icon={Award} title="No score entries yet" description={`Nothing recorded in the last ${days} days.`} />
        )}
        {!isLoading && !isError && ranked.length > 0 && (
          <ul className="flex flex-col gap-2">
            {ranked.map((r) => (
              <li key={r.employeeId} className="flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span className={`font-medium tabular-nums ${r.sum >= 0 ? "text-success" : "text-critical"}`}>
                  {r.sum > 0 ? "+" : ""}
                  {r.sum}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

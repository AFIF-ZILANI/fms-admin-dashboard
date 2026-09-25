import { PayrollCostTrendChart } from "@/pages/employees/payroll-cost-trend-chart";
import { PerformanceLeaderboardCard } from "@/pages/employees/performance-leaderboard-card";

// Two panels, not four. A rating histogram over a five-person team is five bars,
// and a role donut restated the column in the table directly below it.
export function EmployeesAnalytics() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PayrollCostTrendChart />
      <PerformanceLeaderboardCard />
    </div>
  );
}

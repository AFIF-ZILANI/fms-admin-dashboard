import { PayrollCostTrendChart } from "@/pages/employees/payroll-cost-trend-chart";
import { RoleBreakdownChart } from "@/pages/employees/role-breakdown-chart";
import { RatingDistributionChart } from "@/pages/employees/rating-distribution-chart";
import { PerformanceLeaderboardCard } from "@/pages/employees/performance-leaderboard-card";

export function EmployeesAnalytics() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PayrollCostTrendChart />
        <RoleBreakdownChart />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RatingDistributionChart />
        <PerformanceLeaderboardCard />
      </div>
    </div>
  );
}

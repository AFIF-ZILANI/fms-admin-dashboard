import { AlertCircle, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useGetData, type Paginated } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { CATEGORICAL_COLORS, CHART_HEIGHT, chartAxisProps, chartGridProps, chartTooltipContentStyle } from "@/pages/analytics/chart-theme";
import { EMPLOYEE_ROLES, type Employee } from "@/pages/employees/types";

export function RoleBreakdownChart() {
  const { data, isLoading, isError } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const employees = data?.results ?? [];

  const rows = EMPLOYEE_ROLES.map((role) => ({
    role,
    active: employees.filter((e) => e.role === role && e.profile.is_active).length,
    inactive: employees.filter((e) => e.role === role && !e.profile.is_active).length,
  })).filter((r) => r.active + r.inactive > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Headcount by role</CardTitle>
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
              <XAxis dataKey="role" tickFormatter={humanizeEnum} {...chartAxisProps} />
              <YAxis allowDecimals={false} {...chartAxisProps} />
              <Tooltip contentStyle={chartTooltipContentStyle} labelFormatter={(label) => humanizeEnum(String(label))} />
              <Bar dataKey="active" name="Active" stackId="headcount" fill={CATEGORICAL_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="inactive" name="Inactive" stackId="headcount" fill={CATEGORICAL_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

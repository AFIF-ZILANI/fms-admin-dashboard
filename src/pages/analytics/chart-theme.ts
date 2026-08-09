/** Shared visual constants for every Analytics chart — one place to keep
 * grid/axis treatment recessive and marks thin, per docs/design.md §5
 * ("minimal gridlines, no 3D or gradient fills, one accent color per chart
 * max") and the dataviz skill's mark specs. */

export const CHART_HEIGHT = 240;

export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
  vertical: false,
};

export const chartAxisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

export const chartTooltipContentStyle: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  fontSize: 12,
};

export const SINGLE_SERIES_STROKE = "var(--color-chart-5)";
export const CATEGORICAL_COLORS = [
  "var(--color-chart-cat-1)",
  "var(--color-chart-cat-2)",
  "var(--color-chart-cat-3)",
  "var(--color-chart-cat-4)",
];
export const OTHER_COLOR = "var(--color-muted-foreground)";

"use client";

import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  data: { schoolName: string; total: number }[];
}

function truncateLabel(name: string, max = 13): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function CompactTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { schoolName: string; total: number } }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const { schoolName, total } = payload[0].payload;
  return (
    <div className="max-w-[220px] rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold text-brand-900">{schoolName}</p>
      <p className="text-brand-700">Total Enrollment: {total}</p>
    </div>
  );
}

/**
 * Top-schools-by-enrollment chart for Monthly Analytics. Horizontal bars —
 * each school gets its own row with the full name printed beside it, so
 * long school names never overlap or get clipped the way rotated X-axis
 * labels would on a narrow mobile screen.
 */
export const SchoolComparisonChart = memo(function SchoolComparisonChart({ data }: Props) {
  const rows = data.filter((d) => d.total > 0).slice(0, 10);

  if (rows.length === 0) {
    return (
      <EmptyState icon="📊" title="No enrollment data available" description="No schools have positive enrollment totals for this period." />
    );
  }

  const chartData = rows.map((d) => ({ ...d, shortName: truncateLabel(d.schoolName) }));
  const height = Math.max(220, chartData.length * 36);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          barCategoryGap={10}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#d6f5e0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="shortName"
            tick={{ fontSize: 10 }}
            width={90}
            interval={0}
          />
          <Tooltip trigger="click" content={<CompactTooltip />} cursor={{ fill: "#f0faf4" }} />
          <Bar dataKey="total" name="Total Enrollment" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {chartData.map((_, i) => (
              <Cell key={i} fill="#0f7a41" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

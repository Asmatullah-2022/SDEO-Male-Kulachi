"use client";

import { memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDisplayDate } from "@/lib/date";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  data: { date: string; total: number }[];
  /** Custom X-axis tick label, e.g. day-of-month only for a single-month view. Defaults to DD-MM-YYYY. */
  formatLabel?: (isoDate: string) => string;
}

function CompactTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-semibold text-brand-900">{label}</p>
      <p className="text-brand-700">Total Enrollment: {payload[0].value}</p>
    </div>
  );
}

export const EnrollmentTrendChart = memo(function EnrollmentTrendChart({ data, formatLabel }: Props) {
  if (data.length === 0) {
    return <EmptyState icon="📈" title="No data available" description="No enrollment reports for this period yet." />;
  }

  const labelFn = formatLabel ?? formatDisplayDate;
  const chartData = data.map((d) => ({ ...d, label: labelFn(d.date) }));

  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6f5e0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
          <Tooltip trigger="click" content={<CompactTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            name="Total Enrollment"
            stroke="#0f7a41"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

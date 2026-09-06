"use client";

import { memo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDisplayDate } from "@/lib/date";

interface Props {
  data: { date: string; total: number }[];
}

export const EnrollmentTrendChart = memo(function EnrollmentTrendChart({ data }: Props) {
  const chartData = data.map((d) => ({ ...d, label: formatDisplayDate(d.date) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6f5e0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="total" name="Total Enrollment" stroke="#0f7a41" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

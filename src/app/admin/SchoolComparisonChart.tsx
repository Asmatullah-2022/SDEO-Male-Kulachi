"use client";

import { memo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { schoolName: string; total: number }[];
}

/** Simple top-schools-by-enrollment bar chart for the Monthly Analytics section. */
export const SchoolComparisonChart = memo(function SchoolComparisonChart({ data }: Props) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6f5e0" />
          <XAxis dataKey="schoolName" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="total" name="Total Enrollment" fill="#0f7a41" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

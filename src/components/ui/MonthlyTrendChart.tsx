"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { MonthlyTrendPoint } from "@/types";

type MonthlyTrendChartProps = {
  points: MonthlyTrendPoint[];
  height?: number;
};

function shortLabel(point: MonthlyTrendPoint) {
  return `${point.month}月`;
}

export default function MonthlyTrendChart({ points, height = 200 }: MonthlyTrendChartProps) {
  const data = points.map((p) => ({ ...p, shortLabel: shortLabel(p) }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e0d8" strokeDasharray="3 3" />
          <XAxis
            dataKey="shortLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#9e9a93" }}
          />
          <Tooltip
            formatter={(value: number | undefined) =>
              value != null ? [`¥${value.toLocaleString()}`, "支出合計"] : ["—", "支出合計"]
            }
            labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
            contentStyle={{
              borderRadius: 10,
              fontSize: 13,
              padding: "6px 12px",
              background: "#fffdf8",
              border: "1px solid #e5e0d8",
            }}
          />
          <Bar
            dataKey="totalPersonalAmount"
            fill="#c9a227"
            radius={[6, 6, 0, 0]}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

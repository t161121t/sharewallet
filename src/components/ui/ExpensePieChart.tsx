"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import CategoryIcon, {
  type CategoryName,
} from "@/components/icons/CategoryIcon";

/* ---------- データ型 ---------- */

export type ExpenseCategory = {
  name: CategoryName;
  value: number;
  color: string;
};

const DEFAULT_DATA: ExpenseCategory[] = [
  { name: "食費", value: 13900, color: "#ef4444" },
  { name: "貯金", value: 30000, color: "#22c55e" },
  { name: "住居", value: 17400, color: "#f97316" },
  { name: "交通", value: 2100, color: "#38bdf8" },
  { name: "娯楽", value: 4500, color: "#8b5cf6" },
  { name: "日用品", value: 3200, color: "#f59e0b" },
];

/* ---------- 凡例 ---------- */

function ChartLegend({ data }: { data: ExpenseCategory[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-5 gap-y-3 w-full mt-4 px-1">
      {data.map((item) => (
        <div key={item.name} className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <CategoryIcon
            category={item.name}
            size={18}
            className="shrink-0"
            style={{ color: item.color }}
          />
          <span className="text-sm font-semibold text-[#3d3a36] dark:text-[#d5d0c8] truncate">
            {item.name}
          </span>
          <span className="text-xs font-medium text-[#7a756d] dark:text-[#9e9a93] ml-auto tabular-nums whitespace-nowrap">
            ¥{item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- メインコンポーネント ---------- */

type ExpensePieChartProps = {
  data?: ExpenseCategory[];
  size?: number;
};

export default function ExpensePieChart({
  data = DEFAULT_DATA,
  size = 220,
}: ExpensePieChartProps) {
  const hasCustomData = data !== DEFAULT_DATA;
  const filteredData = data.filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData =
    filteredData.length > 0
      ? filteredData
      : hasCustomData
        ? [{ name: "その他" as CategoryName, value: 1, color: "#e5e0d8" }]
        : DEFAULT_DATA;

  return (
    <div className="flex flex-col items-center w-full">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.28}
              outerRadius={size * 0.46}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              strokeWidth={0}
              animationDuration={800}
              animationEasing="ease-out"
              label={false}
              labelLine={false}
            >
              {chartData.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <text
              x="50%"
              y="46%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#9e9a93"
              style={{ fontSize: 11 }}
            >
              合計
            </text>
            <text
              x="50%"
              y="56%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#3d3a36"
              style={{ fontSize: 15, fontWeight: 700 }}
            >
              ¥{total.toLocaleString()}
            </text>
            <Tooltip
              formatter={(value: number | undefined) =>
                value != null
                  ? [`¥${value.toLocaleString()}`, "金額"]
                  : ["—", "金額"]
              }
              contentStyle={{
                borderRadius: 10,
                fontSize: 14,
                padding: "6px 14px",
                background: "#fffdf8",
                border: "1px solid #e5e0d8",
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend data={hasCustomData ? data : chartData} />
    </div>
  );
}

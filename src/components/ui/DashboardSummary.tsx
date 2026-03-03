"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DashboardSummaryResponse } from "@/types";
import CategoryIcon from "@/components/icons/CategoryIcon";

type DashboardSummaryProps = {
  summary: DashboardSummaryResponse;
};

const PIE_COLORS = [
  "#c9a227",
  "#34a853",
  "#3498db",
  "#9b59b6",
  "#e67e22",
  "#e74c3c",
];

const CATEGORY_COLORS = {
  貯金: "#34a853",
  住居: "#e67e22",
  交通: "#3498db",
  食費: "#e74c3c",
  娯楽: "#9b59b6",
  その他: "#94a3b8",
} as const;

export default function DashboardSummary({ summary }: DashboardSummaryProps) {
  const hasGroupData = summary.byGroup.some((g) => g.amount > 0);
  const visibleGroups = summary.byGroup.filter((g) => g.amount > 0);
  const visibleCategories = summary.byCategory.filter((c) => c.amount > 0);

  return (
    <section className="w-full rounded-2xl border border-[#ece6dc] dark:border-[#3a3733] bg-white/80 dark:bg-[#1f1f1f]/70 p-4 mb-5">
      <h2 className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1]">
        今月サマリー（自分が登録した支出）
      </h2>

      <div className="mt-3 rounded-xl bg-[#f8f4ee] dark:bg-[#262522] px-4 py-3">
        <p className="text-xs text-[#7a756d] dark:text-[#9e9a93]">今月合計</p>
        <p className="text-2xl font-extrabold text-[#2d2a26] dark:text-[#f1ede6]">
          ¥{summary.totalAmount.toLocaleString()}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold text-[#3d3a36] dark:text-[#d5d0c8] mb-2">
          グループ別
        </p>
        {hasGroupData ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={visibleGroups}
                  dataKey="amount"
                  nameKey="groupName"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={72}
                  strokeWidth={0}
                  paddingAngle={2}
                >
                  {visibleGroups.map((entry, index) => (
                    <Cell
                      key={entry.groupId}
                      fill={entry.groupColor || PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) =>
                    value != null
                      ? [`¥${value.toLocaleString()}`, "金額"]
                      : ["—", "金額"]
                  }
                  contentStyle={{
                    borderRadius: 10,
                    fontSize: 13,
                    padding: "6px 12px",
                    background: "#fffdf8",
                    border: "1px solid #e5e0d8",
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#dfd8cd] dark:border-[#47433d] p-3 text-sm text-[#7a756d] dark:text-[#9e9a93]">
            今月の支出データはまだありません
          </div>
        )}

        {hasGroupData && (
          <div className="mt-2 space-y-1">
            {visibleGroups
              .sort((a, b) => b.amount - a.amount)
              .map((g, idx) => (
                <div
                  key={g.groupId}
                  className="flex items-center justify-between text-sm text-[#3d3a36] dark:text-[#d5d0c8]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          g.groupColor || PIE_COLORS[idx % PIE_COLORS.length],
                      }}
                    />
                    <span className="truncate">{g.groupName}</span>
                  </div>
                  <span className="font-semibold tabular-nums">
                    ¥{g.amount.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#3d3a36] dark:text-[#d5d0c8] mb-2">
          ジャンル別
        </p>
        {visibleCategories.length > 0 ? (
          <div className="space-y-2">
            {visibleCategories
              .sort((a, b) => b.amount - a.amount)
              .map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-lg bg-[#f8f4ee] dark:bg-[#262522] px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm text-[#3d3a36] dark:text-[#d5d0c8]">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full"
                      style={{ backgroundColor: `${CATEGORY_COLORS[item.category]}22` }}
                    >
                      <CategoryIcon
                        category={item.category}
                        size={18}
                        style={{ color: CATEGORY_COLORS[item.category] }}
                      />
                    </span>
                    <span>{item.category}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#2d2a26] dark:text-[#f1ede6] tabular-nums">
                    ¥{item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-[#7a756d] dark:text-[#9e9a93]">
            ジャンル集計は0件です
          </p>
        )}
      </div>
    </section>
  );
}

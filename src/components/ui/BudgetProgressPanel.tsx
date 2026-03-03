"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryIcon from "@/components/icons/CategoryIcon";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { BudgetProgressResponse, CategoryBudget, CategoryName } from "@/types";

type BudgetProgressPanelProps = {
  budgets: CategoryBudget[];
  progress: BudgetProgressResponse | null;
  loading: boolean;
  saving: boolean;
  onSave: (items: CategoryBudget[]) => Promise<void> | void;
};

const CATEGORY_COLORS: Record<CategoryName, string> = {
  貯金: "#34a853",
  住居: "#e67e22",
  交通: "#3498db",
  食費: "#e74c3c",
  娯楽: "#9b59b6",
  その他: "#94a3b8",
};

export default function BudgetProgressPanel({
  budgets,
  progress,
  loading,
  saving,
  onSave,
}: BudgetProgressPanelProps) {
  const [draft, setDraft] = useState<Record<CategoryName, string>>({
    貯金: "0",
    住居: "0",
    交通: "0",
    食費: "0",
    娯楽: "0",
    その他: "0",
  });

  useEffect(() => {
    const next: Record<CategoryName, string> = {
      貯金: "0",
      住居: "0",
      交通: "0",
      食費: "0",
      娯楽: "0",
      その他: "0",
    };
    for (const row of budgets) {
      next[row.category] = String(row.amount);
    }
    setDraft(next);
  }, [budgets]);

  const hasChanged = useMemo(
    () =>
      budgets.some((row) => {
        const current = Number(draft[row.category] || "0");
        return current !== row.amount;
      }),
    [budgets, draft]
  );

  const handleSave = async () => {
    const items = (Object.keys(draft) as CategoryName[]).map((category) => ({
      category,
      amount: Math.max(0, Math.round(Number(draft[category] || "0"))),
    }));
    await onSave(items);
  };

  return (
    <section className="w-full rounded-2xl border border-[#ece6dc] dark:border-[#3a3733] bg-white/80 dark:bg-[#1f1f1f]/70 p-4 mt-5">
      <h2 className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1]">
        カテゴリ別予算（今月）
      </h2>

      <div className="grid grid-cols-2 gap-3 mt-3">
        {(Object.keys(draft) as CategoryName[]).map((category) => (
          <label
            key={category}
            className="rounded-xl border border-[#e5e0d8] dark:border-[#333230] bg-[#f8f4ee] dark:bg-[#262522] px-3 py-2"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#3d3a36] dark:text-[#d5d0c8] mb-1">
              <CategoryIcon
                category={category}
                size={16}
                style={{ color: CATEGORY_COLORS[category] }}
              />
              {category}
            </div>
            <input
              type="number"
              min={0}
              step={1}
              value={draft[category]}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  [category]: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
              className="w-full h-9 rounded-lg px-2 border border-[#e5e0d8] dark:border-[#333230] bg-white dark:bg-[#1c1b19] text-sm"
            />
          </label>
        ))}
      </div>

      <div className="mt-3">
        <PrimaryButton onClick={handleSave} loading={saving} disabled={!hasChanged || loading}>
          予算を保存
        </PrimaryButton>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[#3d3a36] dark:text-[#d5d0c8]">
          進捗
        </h3>
        {loading || !progress ? (
          <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] mt-2">読み込み中...</p>
        ) : (
          <div className="mt-2 space-y-2">
            {progress.items.map((item) => {
              const color = CATEGORY_COLORS[item.category];
              const width = `${Math.min(item.percent, 100)}%`;
              return (
                <div
                  key={item.category}
                  className="rounded-lg bg-[#f8f4ee] dark:bg-[#262522] px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-[#3d3a36] dark:text-[#d5d0c8]">
                      <CategoryIcon category={item.category} size={16} style={{ color }} />
                      <span>{item.category}</span>
                    </div>
                    <span
                      className={[
                        "font-semibold tabular-nums",
                        item.overBudget ? "text-red-600 dark:text-red-400" : "text-[#2d2a26] dark:text-[#f1ede6]",
                      ].join(" ")}
                    >
                      ¥{item.spent.toLocaleString()} / ¥{item.budget.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[#e9e2d7] dark:bg-[#383430] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width,
                        backgroundColor: item.overBudget ? "#ef4444" : color,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[#7a756d] dark:text-[#9e9a93]">
                      進捗: {item.percent.toFixed(1)}%
                    </span>
                    <span
                      className={
                        item.overBudget
                          ? "text-red-600 dark:text-red-400 font-semibold"
                          : "text-[#7a756d] dark:text-[#9e9a93]"
                      }
                    >
                      {item.overBudget
                        ? `超過: ¥${Math.abs(item.remaining).toLocaleString()}`
                        : `残り: ¥${item.remaining.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import type { CategoryName, DashboardCategorySummary, DashboardGroupSummary } from "@/types";

export function normalizeCategory(category: string): CategoryName {
  if (category === "交通費") return "交通";
  if (category === "住居費") return "住居";
  if (category === "通信費") return "通信";
  if (category === "医療費") return "医療";
  const valid: CategoryName[] = [
    "貯金", "住居", "交通", "食費", "娯楽",
    "医療", "日用品", "通信", "美容", "教育", "その他",
  ];
  if (valid.includes(category as CategoryName)) return category as CategoryName;
  return "その他";
}

/** year(西暦)・month(1-12)の月初〜翌月初の範囲を返す */
export function getMonthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1),
  };
}

/** year・month(1-12)から1ヶ月前のyear・monthを返す */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** baseから遡ってcount件(baseを含む)のyear・monthを古い順で返す */
export function getRecentMonths(
  base: { year: number; month: number },
  count: number
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let cursor = { year: base.year, month: base.month };
  for (let i = 0; i < count; i++) {
    result.unshift(cursor);
    cursor = getPreviousMonth(cursor.year, cursor.month);
  }
  return result;
}

export type ExpenseForAggregation = {
  amount: number;
  category: string;
  date: Date;
  group: { id: string; name: string; color: string };
};

/** グループ別・カテゴリ別の集計(1ヶ月分の一覧を渡す想定) */
export function aggregateByGroupAndCategory(expenses: ExpenseForAggregation[]): {
  totalPersonalAmount: number;
  byGroup: DashboardGroupSummary[];
  byCategory: DashboardCategorySummary[];
} {
  const groupMap = new Map<string, DashboardGroupSummary>();
  const categoryMap = new Map<CategoryName, number>();
  let totalPersonalAmount = 0;

  for (const expense of expenses) {
    totalPersonalAmount += expense.amount;

    const existingGroup = groupMap.get(expense.group.id);
    if (existingGroup) {
      existingGroup.amount += expense.amount;
    } else {
      groupMap.set(expense.group.id, {
        groupId: expense.group.id,
        groupName: expense.group.name,
        groupColor: expense.group.color,
        amount: expense.amount,
      });
    }

    const normalizedCategory = normalizeCategory(expense.category);
    categoryMap.set(
      normalizedCategory,
      (categoryMap.get(normalizedCategory) ?? 0) + expense.amount
    );
  }

  const byGroup = Array.from(groupMap.values()).sort((a, b) => b.amount - a.amount);
  const byCategory: DashboardCategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalPersonalAmount, byGroup, byCategory };
}

/** 複数月にまたがる一覧を、月ごとの合計(円グラフ用の内訳は持たない)にバケット分けする */
export function bucketMonthlyTotals(
  expenses: { amount: number; date: Date }[],
  months: { year: number; month: number }[]
): number[] {
  const totals = months.map(() => 0);
  const index = new Map(months.map((m, i) => [`${m.year}-${m.month}`, i]));

  for (const expense of expenses) {
    const key = `${expense.date.getFullYear()}-${expense.date.getMonth() + 1}`;
    const i = index.get(key);
    if (i !== undefined) totals[i] += expense.amount;
  }

  return totals;
}

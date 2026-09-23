import { describe, expect, it } from "vitest";
import {
  aggregateByGroupAndCategory,
  bucketMonthlyTotals,
  getMonthRange,
  getPreviousMonth,
  getRecentMonths,
  normalizeCategory,
} from "@/lib/dashboardAggregation";

describe("normalizeCategory", () => {
  it("旧カテゴリ名を新カテゴリ名にマッピングする", () => {
    expect(normalizeCategory("交通費")).toBe("交通");
    expect(normalizeCategory("住居費")).toBe("住居");
    expect(normalizeCategory("通信費")).toBe("通信");
    expect(normalizeCategory("医療費")).toBe("医療");
  });

  it("既に正規のカテゴリ名ならそのまま返す", () => {
    expect(normalizeCategory("食費")).toBe("食費");
  });

  it("未知のカテゴリ名は「その他」にフォールバックする", () => {
    expect(normalizeCategory("不明なカテゴリ")).toBe("その他");
  });
});

describe("getMonthRange", () => {
  it("指定した年月の月初〜翌月初の範囲を返す", () => {
    const { from, to } = getMonthRange(2026, 3);
    expect(from).toEqual(new Date(2026, 2, 1));
    expect(to).toEqual(new Date(2026, 3, 1));
  });

  it("12月を指定すると翌年1月にロールオーバーする", () => {
    const { from, to } = getMonthRange(2026, 12);
    expect(from).toEqual(new Date(2026, 11, 1));
    expect(to).toEqual(new Date(2027, 0, 1));
  });
});

describe("getPreviousMonth", () => {
  it("通常の月は1つ前の月を返す", () => {
    expect(getPreviousMonth(2026, 3)).toEqual({ year: 2026, month: 2 });
  });

  it("1月の前は前年12月になる(年をまたぐ)", () => {
    expect(getPreviousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe("getRecentMonths", () => {
  it("基準月を含めてcount件を古い順で返す", () => {
    expect(getRecentMonths({ year: 2026, month: 3 }, 3)).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
  });

  it("年をまたいでも正しく遡る", () => {
    expect(getRecentMonths({ year: 2026, month: 1 }, 3)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });
});

describe("aggregateByGroupAndCategory", () => {
  it("グループ別・カテゴリ別に金額を集計し降順ソートする", () => {
    const result = aggregateByGroupAndCategory([
      { amount: 1000, category: "食費", date: new Date(2026, 2, 1), group: { id: "g1", name: "旅行", color: "#111" } },
      { amount: 3000, category: "交通費", date: new Date(2026, 2, 2), group: { id: "g1", name: "旅行", color: "#111" } },
      { amount: 500, category: "食費", date: new Date(2026, 2, 3), group: { id: "g2", name: "同居", color: "#222" } },
    ]);

    expect(result.totalPersonalAmount).toBe(4500);
    expect(result.byGroup).toEqual([
      { groupId: "g1", groupName: "旅行", groupColor: "#111", amount: 4000 },
      { groupId: "g2", groupName: "同居", groupColor: "#222", amount: 500 },
    ]);
    expect(result.byCategory).toEqual([
      { category: "交通", amount: 3000 },
      { category: "食費", amount: 1500 },
    ]);
  });

  it("空配列なら合計0・空配列を返す", () => {
    const result = aggregateByGroupAndCategory([]);
    expect(result).toEqual({ totalPersonalAmount: 0, byGroup: [], byCategory: [] });
  });
});

describe("bucketMonthlyTotals", () => {
  it("各支出を対応する月にバケット分けする", () => {
    const months = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ];
    const totals = bucketMonthlyTotals(
      [
        { amount: 1000, date: new Date(2026, 0, 15) },
        { amount: 2000, date: new Date(2026, 1, 1) },
        { amount: 500, date: new Date(2026, 1, 28) },
        { amount: 4000, date: new Date(2026, 2, 10) },
      ],
      months
    );
    expect(totals).toEqual([1000, 2500, 4000]);
  });

  it("対象範囲外の月の支出は無視する", () => {
    const months = [{ year: 2026, month: 3 }];
    const totals = bucketMonthlyTotals(
      [{ amount: 999, date: new Date(2025, 11, 31) }],
      months
    );
    expect(totals).toEqual([0]);
  });
});

import { describe, expect, it } from "vitest";
import { calculateSettlement } from "@/lib/settlement";
import type { ExpenseRecord, GroupMember } from "@/types";

function member(id: string, name: string): GroupMember {
  return { id, name, color: "#111111" };
}

function expense(
  memberId: string,
  amount: number,
  shares?: { userId: string; percent: number }[]
): ExpenseRecord {
  return {
    id: `exp-${memberId}-${amount}`,
    category: "食費",
    amount,
    memberId,
    memberName: "",
    date: "2026-01-01T00:00:00.000Z",
    shares,
  };
}

function balanceOf(
  result: ReturnType<typeof calculateSettlement>,
  userId: string
): number {
  return result.memberBalances.find((b) => b.userId === userId)?.balance ?? 0;
}

describe("calculateSettlement", () => {
  it("支出が0件のとき全員のバランスが0で精算トランザクションも空", () => {
    const members = [member("a", "A"), member("b", "B")];

    const result = calculateSettlement(members, []);

    expect(result.expenseCount).toBe(0);
    expect(result.totalExpenseAmount).toBe(0);
    expect(result.transactions).toEqual([]);
    expect(result.memberBalances.every((b) => b.balance === 0)).toBe(true);
  });

  it("2人で均等割りのとき支払者が相手分を受け取る", () => {
    const members = [member("a", "A"), member("b", "B")];
    const expenses = [expense("a", 3000)];

    const result = calculateSettlement(members, expenses);

    expect(result.totalExpenseAmount).toBe(3000);
    expect(balanceOf(result, "a")).toBe(1500);
    expect(balanceOf(result, "b")).toBe(-1500);
    expect(result.transactions).toEqual([
      expect.objectContaining({
        fromUserId: "b",
        toUserId: "a",
        amount: 1500,
      }),
    ]);
  });

  it("3人で均等割りのとき負債者2人が支払者へ送金する", () => {
    const members = [member("a", "A"), member("b", "B"), member("c", "C")];
    const expenses = [expense("a", 9000)];

    const result = calculateSettlement(members, expenses);

    expect(balanceOf(result, "a")).toBe(6000);
    expect(balanceOf(result, "b")).toBe(-3000);
    expect(balanceOf(result, "c")).toBe(-3000);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromUserId: "b", toUserId: "a", amount: 3000 }),
        expect.objectContaining({ fromUserId: "c", toUserId: "a", amount: 3000 }),
      ])
    );
  });

  it("カスタム配分（60/40）で正しいバランスと精算になる", () => {
    const members = [member("a", "A"), member("b", "B")];
    const expenses = [
      expense("a", 10000, [
        { userId: "a", percent: 60 },
        { userId: "b", percent: 40 },
      ]),
    ];

    const result = calculateSettlement(members, expenses);

    expect(balanceOf(result, "a")).toBe(4000);
    expect(balanceOf(result, "b")).toBe(-4000);
    expect(result.transactions).toEqual([
      expect.objectContaining({
        fromUserId: "b",
        toUserId: "a",
        amount: 4000,
      }),
    ]);
  });

  it("複数支出を合算して精算できる", () => {
    const members = [member("a", "A"), member("b", "B")];
    const expenses = [expense("a", 2000), expense("b", 1000)];

    const result = calculateSettlement(members, expenses);

    expect(result.totalExpenseAmount).toBe(3000);
    expect(result.expenseCount).toBe(2);
    expect(balanceOf(result, "a")).toBe(500);
    expect(balanceOf(result, "b")).toBe(-500);
    expect(result.transactions).toEqual([
      expect.objectContaining({
        fromUserId: "b",
        toUserId: "a",
        amount: 500,
      }),
    ]);
  });

  it("均等割りで端数が出るとき四捨五入したバランスになる", () => {
    const members = [member("a", "A"), member("b", "B"), member("c", "C")];
    const expenses = [expense("a", 1000)];

    const result = calculateSettlement(members, expenses);

    expect(balanceOf(result, "a")).toBe(667);
    expect(balanceOf(result, "b")).toBe(-333);
    expect(balanceOf(result, "c")).toBe(-333);
    const paidTotal = result.transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(paidTotal).toBe(666);
  });

  it("shares が空配列のときは均等割りとして扱う", () => {
    const members = [member("a", "A"), member("b", "B")];
    const expenses = [expense("a", 2000, [])];

    const result = calculateSettlement(members, expenses);

    expect(balanceOf(result, "a")).toBe(1000);
    expect(balanceOf(result, "b")).toBe(-1000);
  });

  it("精算トランザクションの合計が負債の絶対値と一致する", () => {
    const members = [
      member("a", "A"),
      member("b", "B"),
      member("c", "C"),
      member("d", "D"),
    ];
    const expenses = [
      expense("a", 5000),
      expense("b", 3000, [
        { userId: "a", percent: 50 },
        { userId: "b", percent: 30 },
        { userId: "c", percent: 20 },
      ]),
      expense("c", 1200),
    ];

    const result = calculateSettlement(members, expenses);
    const totalDebt = result.memberBalances
      .filter((b) => b.balance < 0)
      .reduce((sum, b) => sum + Math.abs(b.balance), 0);
    const totalPaid = result.transactions.reduce((sum, t) => sum + t.amount, 0);

    expect(totalPaid).toBe(totalDebt);
    result.transactions.forEach((t) => {
      expect(t.amount).toBeGreaterThan(0);
      expect(t.fromUserId).not.toBe(t.toUserId);
    });
  });
});

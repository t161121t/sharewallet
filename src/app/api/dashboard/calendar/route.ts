import { NextRequest, NextResponse } from "next/server";
import type { ApiError, CategoryName, DashboardCalendar } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

function getPeriod(searchParams: URLSearchParams) {
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month, from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
}

/** GET /api/dashboard/calendar?year=2026&month=9 - 月間カレンダー用の日別支出 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const period = getPeriod(req.nextUrl.searchParams);
    if (!period) {
      return NextResponse.json<ApiError>({ error: "year は2000〜2100、month は1〜12で指定してください" }, { status: 400 });
    }

    const expenses = await prisma.expense.findMany({
      where: {
        memberId: userId,
        date: { gte: period.from, lt: period.to },
        group: { members: { some: { userId } } },
      },
      select: { id: true, amount: true, category: true, memo: true, date: true, group: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const byDate = new Map<string, DashboardCalendar["days"][number]>();
    for (const expense of expenses) {
      const date = `${expense.date.getFullYear()}-${String(expense.date.getMonth() + 1).padStart(2, "0")}-${String(expense.date.getDate()).padStart(2, "0")}`;
      const day = byDate.get(date) ?? { date, totalPersonalAmount: 0, expenseCount: 0, expenses: [] };
      day.totalPersonalAmount += expense.amount;
      day.expenseCount += 1;
      day.expenses.push({
        id: expense.id,
        amount: expense.amount,
        category: expense.category as CategoryName,
        memo: expense.memo,
        groupName: expense.group.name,
      });
      byDate.set(date, day);
    }

    return NextResponse.json<DashboardCalendar>({ year: period.year, month: period.month, days: Array.from(byDate.values()) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.json<ApiError>({ error: "カレンダーの取得に失敗しました" }, { status: 500 });
  }
}

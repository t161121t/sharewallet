import { NextRequest, NextResponse } from "next/server";
import type { ApiError, CategoryName, DashboardCalendar } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { formatDashboardDate, getDashboardPeriod } from "@/lib/dashboardTime";

function normalizeCategory(category: string): CategoryName {
  if (category === "交通費") return "交通";
  if (category === "住居費") return "住居";
  if (category === "通信費") return "通信";
  if (category === "医療費") return "医療";
  const categories: CategoryName[] = ["貯金", "住居", "交通", "食費", "娯楽", "医療", "日用品", "通信", "美容", "教育", "その他"];
  return categories.includes(category as CategoryName) ? category as CategoryName : "その他";
}

/** GET /api/dashboard/calendar?year=2026&month=9 - 月間カレンダー用の日別支出 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const period = getDashboardPeriod(req.nextUrl.searchParams, true);
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
      const date = formatDashboardDate(expense.date, period.timeZone);
      const day = byDate.get(date) ?? { date, totalPersonalAmount: 0, expenseCount: 0, expenses: [] };
      day.totalPersonalAmount += expense.amount;
      day.expenseCount += 1;
      day.expenses.push({
        id: expense.id,
        amount: expense.amount,
        category: normalizeCategory(expense.category),
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

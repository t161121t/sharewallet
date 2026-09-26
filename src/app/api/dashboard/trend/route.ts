import { NextRequest, NextResponse } from "next/server";
import type { ApiError, DashboardTrend } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { formatDashboardDate, getDashboardPeriod, zonedStartOfDay } from "@/lib/dashboardTime";

/** GET /api/dashboard/trend?year=2026&month=9 - 指定月までの6か月推移 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const period = getDashboardPeriod(req.nextUrl.searchParams);
    if (!period) return NextResponse.json<ApiError>({ error: "year は2000〜2100、month は1〜12で指定してください" }, { status: 400 });

    const firstMonth = new Date(period.year, period.month - 6, 1);
    const from = zonedStartOfDay(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 1, period.timeZone);
    const to = period.to;
    const expenses = await prisma.expense.findMany({
      where: { memberId: userId, date: { gte: from, lt: to }, group: { members: { some: { userId } } } },
      select: { amount: true, date: true },
    });
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const [year, month] = formatDashboardDate(expense.date, period.timeZone).split("-").map(Number);
      const key = `${year}-${month}`;
      totals.set(key, (totals.get(key) ?? 0) + expense.amount);
    }
    const points = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(period.year, period.month - 6 + index, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return { year, month, label: `${month}月`, totalPersonalAmount: totals.get(`${year}-${month}`) ?? 0 };
    });
    return NextResponse.json<DashboardTrend>({ points });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    return NextResponse.json<ApiError>({ error: "推移の取得に失敗しました" }, { status: 500 });
  }
}

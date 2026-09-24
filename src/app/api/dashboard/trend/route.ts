import { NextRequest, NextResponse } from "next/server";
import type { ApiError, DashboardTrend } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

function getPeriod(searchParams: URLSearchParams) {
  const now = new Date();
  const year = searchParams.get("year") === null ? now.getFullYear() : Number(searchParams.get("year"));
  const month = searchParams.get("month") === null ? now.getMonth() + 1 : Number(searchParams.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

/** GET /api/dashboard/trend?year=2026&month=9 - 指定月までの6か月推移 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const period = getPeriod(req.nextUrl.searchParams);
    if (!period) return NextResponse.json<ApiError>({ error: "year は2000〜2100、month は1〜12で指定してください" }, { status: 400 });

    const from = new Date(period.year, period.month - 6, 1);
    const to = new Date(period.year, period.month, 1);
    const expenses = await prisma.expense.findMany({
      where: { memberId: userId, date: { gte: from, lt: to }, group: { members: { some: { userId } } } },
      select: { amount: true, date: true },
    });
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const key = `${expense.date.getFullYear()}-${expense.date.getMonth() + 1}`;
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

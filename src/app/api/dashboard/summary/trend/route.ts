import { NextRequest, NextResponse } from "next/server";
import type { ApiError, MonthlyTrendResult } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { bucketMonthlyTotals, getMonthRange, getRecentMonths } from "@/lib/dashboardAggregation";

const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 12;

/** GET /api/dashboard/summary/trend?months=6 - 直近Nヶ月分の個人支出合計の推移 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);

    const monthsParam = req.nextUrl.searchParams.get("months");
    const monthsCount = monthsParam === null ? DEFAULT_MONTHS : Number(monthsParam);
    if (!Number.isInteger(monthsCount) || monthsCount < 1 || monthsCount > MAX_MONTHS) {
      return NextResponse.json<ApiError>(
        { error: `monthsは1〜${MAX_MONTHS}の整数で指定してください` },
        { status: 400 }
      );
    }

    const now = new Date();
    const months = getRecentMonths(
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      monthsCount
    );

    const { from } = getMonthRange(months[0].year, months[0].month);
    const { to } = getMonthRange(months[months.length - 1].year, months[months.length - 1].month);

    const expenses = await prisma.expense.findMany({
      where: {
        memberId: userId,
        date: { gte: from, lt: to },
        group: {
          members: { some: { userId } },
        },
      },
      select: { amount: true, date: true },
    });

    const totals = bucketMonthlyTotals(expenses, months);

    const result: MonthlyTrendResult = {
      points: months.map((m, i) => ({
        year: m.year,
        month: m.month,
        label: `${m.year}年${m.month}月`,
        totalPersonalAmount: totals[i],
      })),
    };

    return NextResponse.json<MonthlyTrendResult>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.json<ApiError>(
      { error: "支出推移の取得に失敗しました" },
      { status: 500 }
    );
  }
}

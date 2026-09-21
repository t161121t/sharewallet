import { NextRequest, NextResponse } from "next/server";
import type { ApiError, DashboardSummary } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import {
  aggregateByGroupAndCategory,
  getMonthRange,
  getPreviousMonth,
} from "@/lib/dashboardAggregation";

function parseYearMonth(req: NextRequest): { year: number; month: number } | { error: string } {
  const now = new Date();
  const yearParam = req.nextUrl.searchParams.get("year");
  const monthParam = req.nextUrl.searchParams.get("month");

  if (yearParam === null && monthParam === null) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const year = Number(yearParam ?? now.getFullYear());
  const month = Number(monthParam ?? now.getMonth() + 1);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "year・monthの指定が不正です" };
  }

  return { year, month };
}

/** GET /api/dashboard/summary?year=&month= - ホーム表示用の指定月集計(省略時は今月) */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);

    const parsed = parseYearMonth(req);
    if ("error" in parsed) {
      return NextResponse.json<ApiError>({ error: parsed.error }, { status: 400 });
    }
    const { year, month } = parsed;

    const { from: periodFrom, to: periodTo } = getMonthRange(year, month);
    const prev = getPreviousMonth(year, month);
    const { from: prevFrom, to: prevTo } = getMonthRange(prev.year, prev.month);

    const expenses = await prisma.expense.findMany({
      where: {
        memberId: userId,
        date: {
          gte: periodFrom,
          lt: periodTo,
        },
        group: {
          members: {
            some: { userId },
          },
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
    const previousMonthAggregate = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        memberId: userId,
        date: {
          gte: prevFrom,
          lt: prevTo,
        },
        group: {
          members: {
            some: { userId },
          },
        },
      },
    });

    const { totalPersonalAmount, byGroup, byCategory } = aggregateByGroupAndCategory(expenses);

    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

    const result: DashboardSummary = {
      totalPersonalAmount,
      previousMonthTotalPersonalAmount: previousMonthAggregate._sum.amount ?? 0,
      byGroup,
      byCategory,
      period: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
        label: isCurrentMonth ? "今月" : `${year}年${month}月`,
      },
    };

    return NextResponse.json<DashboardSummary>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.json<ApiError>(
      { error: "ホーム集計の取得に失敗しました" },
      { status: 500 }
    );
  }
}

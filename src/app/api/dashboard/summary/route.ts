import { NextRequest, NextResponse } from "next/server";
import type { ApiError, DashboardSummaryResponse, CategoryName } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

const DEFAULT_CATEGORIES: CategoryName[] = [
  "貯金",
  "住居",
  "交通",
  "食費",
  "娯楽",
  "その他",
];

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const period = req.nextUrl.searchParams.get("period") ?? "current-month";
    if (period !== "current-month") {
      return NextResponse.json<ApiError>(
        { error: "サポートされていない期間です" },
        { status: 400 }
      );
    }

    const { start, end } = getCurrentMonthRange();
    const expenses = await prisma.expense.findMany({
      where: {
        memberId: userId,
        date: {
          gte: start,
          lt: end,
        },
      },
      select: {
        amount: true,
        category: true,
        group: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byGroupMap = new Map<
      string,
      { groupId: string; groupName: string; groupColor: string; amount: number }
    >();
    for (const e of expenses) {
      const key = e.group.id;
      const existing = byGroupMap.get(key);
      if (existing) {
        existing.amount += e.amount;
      } else {
        byGroupMap.set(key, {
          groupId: e.group.id,
          groupName: e.group.name,
          groupColor: e.group.color,
          amount: e.amount,
        });
      }
    }

    const byCategoryMap = new Map<CategoryName, number>(
      DEFAULT_CATEGORIES.map((c) => [c, 0])
    );
    for (const e of expenses) {
      const category = DEFAULT_CATEGORIES.includes(e.category as CategoryName)
        ? (e.category as CategoryName)
        : "その他";
      byCategoryMap.set(category, (byCategoryMap.get(category) ?? 0) + e.amount);
    }

    const result: DashboardSummaryResponse = {
      totalAmount,
      byGroup: Array.from(byGroupMap.values()).sort((a, b) => b.amount - a.amount),
      byCategory: DEFAULT_CATEGORIES.map((category) => ({
        category,
        amount: byCategoryMap.get(category) ?? 0,
      })).sort((a, b) => b.amount - a.amount),
    };

    return NextResponse.json<DashboardSummaryResponse>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "ホーム集計の取得に失敗しました" },
      { status: 500 }
    );
  }
}

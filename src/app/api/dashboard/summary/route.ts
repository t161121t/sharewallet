import { NextRequest, NextResponse } from "next/server";
import type {
  ApiError,
  CategoryName,
  DashboardCategorySummary,
  DashboardGroupSummary,
  DashboardSummary,
} from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

function normalizeCategory(category: string): CategoryName {
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

/** GET /api/dashboard/summary - ホーム表示用の今月集計 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const now = new Date();
    const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 1);

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

    const result: DashboardSummary = {
      totalPersonalAmount,
      previousMonthTotalPersonalAmount: previousMonthAggregate._sum.amount ?? 0,
      byGroup,
      byCategory,
      period: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
        label: "今月",
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

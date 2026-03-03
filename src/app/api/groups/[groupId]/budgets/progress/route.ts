import { NextRequest, NextResponse } from "next/server";
import type {
  ApiError,
  BudgetProgressItem,
  BudgetProgressResponse,
  CategoryName,
} from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, requireAuthUserId } from "@/lib/auth";

const CATEGORIES: CategoryName[] = ["貯金", "住居", "交通", "食費", "娯楽", "その他"];

function getCurrentMonthKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function parseMonth(value: string | null) {
  if (!value) return getCurrentMonthKey();
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  return value;
}

function getMonthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/** GET /api/groups/[groupId]/budgets/progress?month=YYYY-MM */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);

    const month = parseMonth(req.nextUrl.searchParams.get("month"));
    if (!month) {
      return NextResponse.json<ApiError>(
        { error: "month は YYYY-MM 形式で指定してください" },
        { status: 400 }
      );
    }
    const { start, end } = getMonthRange(month);

    const [budgets, spending] = await Promise.all([
      prisma.categoryBudget.findMany({
        where: { groupId, month },
        select: { category: true, amount: true },
      }),
      prisma.expense.groupBy({
        by: ["category"],
        where: {
          groupId,
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const budgetMap = new Map<string, number>(
      CATEGORIES.map((category) => [category, 0])
    );
    for (const row of budgets) {
      if (CATEGORIES.includes(row.category as CategoryName)) {
        budgetMap.set(row.category, row.amount);
      }
    }

    const spendingMap = new Map<string, number>(
      CATEGORIES.map((category) => [category, 0])
    );
    for (const row of spending) {
      const category = CATEGORIES.includes(row.category as CategoryName)
        ? row.category
        : "その他";
      spendingMap.set(category, (spendingMap.get(category) ?? 0) + (row._sum.amount ?? 0));
    }

    const items: BudgetProgressItem[] = CATEGORIES.map((category) => {
      const budget = budgetMap.get(category) ?? 0;
      const spent = spendingMap.get(category) ?? 0;
      const remaining = budget - spent;
      const percent = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0;
      return {
        category,
        budget,
        spent,
        remaining,
        percent: Number(percent.toFixed(1)),
        overBudget: spent > budget,
      };
    });

    const result: BudgetProgressResponse = {
      month,
      totalBudget: items.reduce((sum, item) => sum + item.budget, 0),
      totalSpent: items.reduce((sum, item) => sum + item.spent, 0),
      items,
    };

    return NextResponse.json<BudgetProgressResponse>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "このグループの予算進捗を閲覧する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "予算進捗の取得に失敗しました" },
      { status: 500 }
    );
  }
}

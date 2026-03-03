import { NextRequest, NextResponse } from "next/server";
import type { ApiError, CategoryBudget, CategoryName } from "@/types";
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

/** GET /api/groups/[groupId]/budgets?month=YYYY-MM */
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

    const rows = await prisma.categoryBudget.findMany({
      where: { groupId, month },
      select: { category: true, amount: true },
    });
    const budgetMap = new Map(rows.map((row) => [row.category, row.amount]));
    const result: CategoryBudget[] = CATEGORIES.map((category) => ({
      category,
      amount: budgetMap.get(category) ?? 0,
    }));

    return NextResponse.json<CategoryBudget[]>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "このグループの予算を閲覧する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "予算の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** PUT /api/groups/[groupId]/budgets */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);

    const body = await req.json().catch(() => null);
    const month = parseMonth(body?.month ?? null);
    if (!month) {
      return NextResponse.json<ApiError>(
        { error: "month は YYYY-MM 形式で指定してください" },
        { status: 400 }
      );
    }
    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json<ApiError>(
        { error: "items は必須です" },
        { status: 400 }
      );
    }

    const normalized = body.items.map((item: unknown) => {
      const row = item as { category?: string; amount?: number };
      return {
        category: row.category,
        amount: Number(row.amount),
      };
    });

    if (
      normalized.some(
        (row) =>
          !row.category ||
          !CATEGORIES.includes(row.category as CategoryName) ||
          !Number.isFinite(row.amount) ||
          row.amount < 0
      )
    ) {
      return NextResponse.json<ApiError>(
        { error: "category と amount(0以上) を正しく指定してください" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      normalized.map((row) =>
        prisma.categoryBudget.upsert({
          where: {
            groupId_category_month: {
              groupId,
              category: row.category!,
              month,
            },
          },
          create: {
            groupId,
            category: row.category!,
            month,
            amount: Math.round(row.amount),
          },
          update: {
            amount: Math.round(row.amount),
          },
        })
      )
    );

    const updated = await prisma.categoryBudget.findMany({
      where: { groupId, month },
      select: { category: true, amount: true },
    });

    const budgetMap = new Map(updated.map((row) => [row.category, row.amount]));
    const result: CategoryBudget[] = CATEGORIES.map((category) => ({
      category,
      amount: budgetMap.get(category) ?? 0,
    }));

    return NextResponse.json<CategoryBudget[]>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "このグループの予算を更新する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "予算の更新に失敗しました" },
      { status: 500 }
    );
  }
}

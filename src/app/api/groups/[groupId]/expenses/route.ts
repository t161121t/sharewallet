import { NextRequest, NextResponse } from "next/server";
import type { ExpenseRecord, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";

type RouteContext = { params: Promise<{ groupId: string }> };

/** GET /api/groups/[groupId]/expenses - 支出一覧取得 */
export const GET = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        member: { select: { id: true, name: true, avatarUrl: true } },
        shares: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });

    const result: ExpenseRecord[] = expenses.map((e) => ({
      id: e.id,
      category: e.category as ExpenseRecord["category"],
      amount: e.amount,
      memberId: e.member.id,
      memberName: e.member.name,
      memberAvatarUrl: e.member.avatarUrl ?? undefined,
      memo: e.memo ?? undefined,
      date: e.date.toISOString(),
      shares: e.shares.map((s) => ({
        userId: s.user.id,
        userName: s.user.name,
        percent: s.percent,
      })),
    }));

    return NextResponse.json<ExpenseRecord[]>(result);
  },
  {
    defaultErrorMessage: "支出一覧取得に失敗しました",
    forbiddenMessage: "このグループの支出を閲覧する権限がありません",
  }
);

/** POST /api/groups/[groupId]/expenses - 支出登録 */
export const POST = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);
    const body = await req.json().catch(() => null);

    if (!body || !body.category || !body.amount) {
      return NextResponse.json<ApiError>(
        { error: "カテゴリと金額は必須です" },
        { status: 400 }
      );
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    const incomingShares: { userId: string; percent: number }[] =
      Array.isArray(body.shares) && body.shares.length > 0
        ? body.shares
        : members.map((m) => ({ userId: m.userId, percent: 100 / members.length }));

    const percentTotal = incomingShares.reduce((sum, s) => sum + Number(s.percent || 0), 0);
    if (Math.abs(percentTotal - 100) > 0.01) {
      return NextResponse.json<ApiError>(
        { error: "配分比率の合計は100%にしてください" },
        { status: 400 }
      );
    }
    if (incomingShares.some((s) => !memberIds.has(s.userId) || s.percent < 0)) {
      return NextResponse.json<ApiError>(
        { error: "配分比率に不正なメンバーまたは値が含まれています" },
        { status: 400 }
      );
    }
    const payerId = body.memberId ?? userId;
    if (!memberIds.has(payerId)) {
      return NextResponse.json<ApiError>(
        { error: "支払いメンバーがグループに存在しません" },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        groupId,
        memberId: payerId,
        category: body.category,
        amount: body.amount,
        memo: body.memo ?? null,
        date: new Date(),
        shares: {
          create: incomingShares.map((s) => ({
            userId: s.userId,
            percent: s.percent,
          })),
        },
      },
      include: {
        member: { select: { id: true, name: true, avatarUrl: true } },
        shares: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    const result: ExpenseRecord = {
      id: expense.id,
      category: expense.category as ExpenseRecord["category"],
      amount: expense.amount,
      memberId: expense.member.id,
      memberName: expense.member.name,
      memberAvatarUrl: expense.member.avatarUrl ?? undefined,
      memo: expense.memo ?? undefined,
      date: expense.date.toISOString(),
      shares: expense.shares.map((s) => ({
        userId: s.user.id,
        userName: s.user.name,
        percent: s.percent,
      })),
    };

    return NextResponse.json<ExpenseRecord>(result, { status: 201 });
  },
  {
    defaultErrorMessage: "支出登録に失敗しました",
    forbiddenMessage: "このグループに支出を登録する権限がありません",
  }
);

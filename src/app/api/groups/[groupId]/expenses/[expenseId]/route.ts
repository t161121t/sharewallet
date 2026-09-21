import { NextRequest, NextResponse } from "next/server";
import type { ApiError, ExpenseRecord } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ groupId: string; expenseId: string }> };

export const PUT = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const userId = await requireAuthUserId(req);
    const { groupId, expenseId } = await params;
    await assertGroupMember(groupId, userId);
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json<ApiError>(
        { error: "リクエストボディが不正です" },
        { status: 400 }
      );
    }

    const current = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { shares: true },
    });
    if (!current || current.groupId !== groupId) {
      return NextResponse.json<ApiError>(
        { error: "支出が見つかりません" },
        { status: 404 }
      );
    }

    if (current.memberId !== userId) {
      await assertGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);
    }

    const shares = Array.isArray(body.shares) ? body.shares : null;
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(body.category !== undefined && { category: body.category }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        ...(body.memo !== undefined && { memo: body.memo }),
        ...(body.memberId !== undefined && { memberId: body.memberId }),
        ...(shares && {
          shares: {
            deleteMany: {},
            create: shares.map((s: { userId: string; percent: number }) => ({
              userId: s.userId,
              percent: Number(s.percent),
            })),
          },
        }),
      },
      include: {
        member: { select: { id: true, name: true, avatarUrl: true } },
        shares: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    const result: ExpenseRecord = {
      id: updated.id,
      category: updated.category as ExpenseRecord["category"],
      amount: updated.amount,
      memberId: updated.member.id,
      memberName: updated.member.name,
      memberAvatarUrl: updated.member.avatarUrl ?? undefined,
      memo: updated.memo ?? undefined,
      date: updated.date.toISOString(),
      shares: updated.shares.map((s) => ({
        userId: s.user.id,
        userName: s.user.name,
        percent: s.percent,
      })),
    };
    return NextResponse.json<ExpenseRecord>(result);
  },
  {
    defaultErrorMessage: "支出編集に失敗しました",
    forbiddenMessage: "支出を編集する権限がありません",
  }
);

export const DELETE = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const userId = await requireAuthUserId(req);
    const { groupId, expenseId } = await params;
    await assertGroupMember(groupId, userId);

    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.groupId !== groupId) {
      return NextResponse.json<ApiError>(
        { error: "支出が見つかりません" },
        { status: 404 }
      );
    }
    if (expense.memberId !== userId) {
      await assertGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);
    }
    await prisma.expense.delete({ where: { id: expenseId } });
    return NextResponse.json({ ok: true });
  },
  {
    defaultErrorMessage: "支出削除に失敗しました",
    forbiddenMessage: "支出を削除する権限がありません",
  }
);

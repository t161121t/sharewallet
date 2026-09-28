import { NextRequest, NextResponse } from "next/server";
import type { ApiError, ExpenseRecord } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { parseExpenseDate } from "@/lib/validation";
import { GroupRole } from "@/generated/prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
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

    let expenseDate: Date | undefined;
    if (body.date !== undefined) {
      const parsedDate = parseExpenseDate(body.date);
      if (!parsedDate) {
        return NextResponse.json<ApiError>(
          { error: "日付はYYYY-MM-DD形式で正しく指定してください" },
          { status: 400 }
        );
      }
      expenseDate = parsedDate;
    }

    const shares = Array.isArray(body.shares) ? body.shares : null;
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(body.category !== undefined && { category: body.category }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        ...(body.memo !== undefined && { memo: body.memo }),
        ...(body.memberId !== undefined && { memberId: body.memberId }),
        ...(expenseDate && { date: expenseDate }),
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
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "支出を編集する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "支出編集に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
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
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "支出を削除する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "支出削除に失敗しました" },
      { status: 500 }
    );
  }
}

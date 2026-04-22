import { NextRequest, NextResponse } from "next/server";
import type { ApiError, SettlementResult, GroupMember, ExpenseRecord } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, requireAuthUserId } from "@/lib/auth";
import { calculateSettlement } from "@/lib/settlement";

/** GET /api/groups/[groupId]/settlement - 精算計算結果取得 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);

    const [groupData, expenses] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } },
          },
        },
      }),
      prisma.expense.findMany({
        where: { groupId },
        include: {
          shares: true,
        },
      }),
    ]);

    if (!groupData) {
      return NextResponse.json<ApiError>({ error: "グループが見つかりません" }, { status: 404 });
    }

    const members: GroupMember[] = groupData.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      color: m.user.color,
      avatarUrl: m.user.avatarUrl ?? undefined,
    }));

    const expenseRecords: ExpenseRecord[] = expenses.map((e) => ({
      id: e.id,
      category: e.category as ExpenseRecord["category"],
      amount: e.amount,
      memberId: e.memberId,
      memberName: "",
      date: e.date.toISOString(),
      shares: e.shares.map((s) => ({ userId: s.userId, percent: s.percent })),
    }));

    const result = calculateSettlement(members, expenseRecords);

    return NextResponse.json<SettlementResult>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "このグループの精算情報を閲覧する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "精算計算に失敗しました" },
      { status: 500 }
    );
  }
}

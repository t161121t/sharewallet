import { NextRequest, NextResponse } from "next/server";
import type { ApiError, SettlementResult, GroupMember, ExpenseRecord } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { calculateSettlement } from "@/lib/settlement";

/** GET /api/groups/[groupId]/settlement - 精算計算結果取得 */
export const GET = withApiErrorHandling<{ params: Promise<{ groupId: string }> }>(
  async (req: NextRequest, { params }) => {
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
  },
  {
    defaultErrorMessage: "精算計算に失敗しました",
    forbiddenMessage: "このグループの精算情報を閲覧する権限がありません",
  }
);

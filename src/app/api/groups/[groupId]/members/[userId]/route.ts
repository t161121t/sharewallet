import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupMember, assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

export const DELETE = withApiErrorHandling<{
  params: Promise<{ groupId: string; userId: string }>;
}>(
  async (req: NextRequest, { params }) => {
    const actorId = await requireAuthUserId(req);
    const { groupId, userId } = await params;
    const actor = await assertGroupMember(groupId, actorId);
    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!target) {
      return NextResponse.json<ApiError>(
        { error: "対象メンバーが見つかりません" },
        { status: 404 }
      );
    }

    const isSelf = actorId === userId;
    if (isSelf) {
      if (actor.role === GroupRole.OWNER) {
        const owners = await prisma.groupMember.count({
          where: { groupId, role: GroupRole.OWNER },
        });
        if (owners <= 1) {
          return NextResponse.json<ApiError>(
            { error: "最後のOWNERは脱退できません" },
            { status: 400 }
          );
        }
      }
    } else {
      await assertGroupRole(groupId, actorId, [GroupRole.OWNER, GroupRole.ADMIN]);
      if (target.role === GroupRole.OWNER && actor.role !== GroupRole.OWNER) {
        return NextResponse.json<ApiError>(
          { error: "OWNERを除外できるのはOWNERのみです" },
          { status: 403 }
        );
      }
    }

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId, groupId } },
    });
    return NextResponse.json({ ok: true });
  },
  {
    defaultErrorMessage: "メンバー除外に失敗しました",
    forbiddenMessage: "メンバーを除外する権限がありません",
  }
);

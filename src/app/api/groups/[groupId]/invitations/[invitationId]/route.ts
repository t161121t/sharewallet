import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

export const DELETE = withApiErrorHandling<{
  params: Promise<{ groupId: string; invitationId: string }>;
}>(
  async (req: NextRequest, { params }) => {
    const actorId = await requireAuthUserId(req);
    const { groupId, invitationId } = await params;
    await assertGroupRole(groupId, actorId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const invitation = await prisma.groupInvitation.findFirst({
      where: { id: invitationId, groupId },
    });
    if (!invitation) {
      return NextResponse.json<ApiError>(
        { error: "招待リンクが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ ok: true });
  },
  {
    defaultErrorMessage: "招待リンクの無効化に失敗しました",
    forbiddenMessage: "招待リンクを無効化する権限がありません",
  }
);

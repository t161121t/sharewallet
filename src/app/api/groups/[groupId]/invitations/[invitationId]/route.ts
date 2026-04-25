import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { GroupRole } from "@/generated/prisma/client";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; invitationId: string }> }
) {
  try {
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
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "招待リンクを無効化する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "招待リンクの無効化に失敗しました" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

export const POST = withApiErrorHandling<{ params: Promise<{ groupId: string }> }>(
  async (req: NextRequest, { params }) => {
    const actorId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupRole(groupId, actorId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const body = await req.json().catch(() => null);
    if (!body?.email || typeof body.email !== "string") {
      return NextResponse.json<ApiError>(
        { error: "追加するユーザーのメールアドレスが必要です" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email.trim() },
      select: { id: true, name: true, color: true, email: true },
    });
    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "指定したメールアドレスのユーザーが見つかりません" },
        { status: 404 }
      );
    }

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId } },
    });
    if (existing) {
      return NextResponse.json<ApiError>(
        { error: "このユーザーは既にグループに参加しています" },
        { status: 409 }
      );
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId: user.id,
        role: GroupRole.MEMBER,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        color: user.color,
        role: member.role,
      },
      { status: 201 }
    );
  },
  {
    defaultErrorMessage: "メンバー追加に失敗しました",
    forbiddenMessage: "メンバーを追加する権限がありません",
  }
);

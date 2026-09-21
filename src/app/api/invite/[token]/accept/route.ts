import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

export const POST = withApiErrorHandling<{ params: Promise<{ token: string }> }>(
  async (req: NextRequest, { params }) => {
    const userId = await requireAuthUserId(req);
    const { token } = await params;

    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      include: { group: { select: { id: true, name: true } } },
    });

    if (!invitation || invitation.status !== "ACTIVE") {
      return NextResponse.json<ApiError>(
        { error: "この招待リンクは無効です" },
        { status: 404 }
      );
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return NextResponse.json<ApiError>(
        { error: "この招待リンクの有効期限が切れています" },
        { status: 410 }
      );
    }

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: invitation.groupId } },
    });

    if (!existing) {
      await prisma.groupMember.create({
        data: { userId, groupId: invitation.groupId, role: GroupRole.MEMBER },
      });
    }

    return NextResponse.json({
      groupId: invitation.groupId,
      groupName: invitation.group.name,
    });
  },
  { defaultErrorMessage: "グループへの参加に失敗しました" }
);

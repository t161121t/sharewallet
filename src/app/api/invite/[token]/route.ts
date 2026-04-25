import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invitation = await prisma.groupInvitation.findUnique({
    where: { token },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
      createdBy: { select: { name: true } },
    },
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

  return NextResponse.json({
    groupId: invitation.groupId,
    groupName: invitation.group.name,
    groupColor: invitation.group.color,
    groupIconUrl: invitation.group.iconUrl ?? undefined,
    memberCount: invitation.group._count.members,
    createdByName: invitation.createdBy.name,
    expiresAt: invitation.expiresAt?.toISOString() ?? null,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { withApiErrorHandling } from "@/lib/apiError";
import { GroupRole } from "@/generated/prisma/client";

type RouteContext = { params: Promise<{ groupId: string }> };

export const POST = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const actorId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupRole(groupId, actorId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const body = await req.json().catch(() => ({}));
    const expiresInDays: number =
      typeof body.expiresInDays === "number" && body.expiresInDays > 0
        ? body.expiresInDays
        : 7;

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.groupInvitation.create({
      data: { token, groupId, createdById: actorId, expiresAt },
    });

    const baseUrl = req.headers.get("origin") ?? "";
    return NextResponse.json(
      {
        id: invitation.id,
        token: invitation.token,
        url: `${baseUrl}/invite/${invitation.token}`,
        expiresAt: invitation.expiresAt?.toISOString() ?? null,
        createdAt: invitation.createdAt.toISOString(),
        status: invitation.status,
      },
      { status: 201 }
    );
  },
  {
    defaultErrorMessage: "招待リンクの作成に失敗しました",
    forbiddenMessage: "招待リンクを作成する権限がありません",
  }
);

export const GET = withApiErrorHandling<RouteContext>(
  async (req: NextRequest, { params }) => {
    const actorId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupRole(groupId, actorId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const invitations = await prisma.groupInvitation.findMany({
      where: { groupId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    const baseUrl = req.headers.get("origin") ?? "";
    return NextResponse.json(
      invitations.map((inv) => ({
        id: inv.id,
        token: inv.token,
        url: `${baseUrl}/invite/${inv.token}`,
        expiresAt: inv.expiresAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
        status: inv.status,
      }))
    );
  },
  {
    defaultErrorMessage: "招待リンクの取得に失敗しました",
    forbiddenMessage: "招待リンクを取得する権限がありません",
  }
);

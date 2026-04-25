import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { assertGroupRole, requireAuthUserId } from "@/lib/auth";
import { GroupRole } from "@/generated/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
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
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "招待リンクを作成する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "招待リンクの作成に失敗しました" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
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
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "招待リンクを取得する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "招待リンクの取得に失敗しました" },
      { status: 500 }
    );
  }
}

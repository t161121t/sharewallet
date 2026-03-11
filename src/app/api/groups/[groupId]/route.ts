import { NextRequest, NextResponse } from "next/server";
import type { Group, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId, assertGroupMember, assertGroupRole } from "@/lib/auth";
import { GroupRole } from "@/generated/prisma/client";

function isUnknownIconUrlError(e: unknown) {
  return (
    e instanceof Error &&
    (e.message.includes("Unknown argument `iconUrl`") ||
      e.message.includes("no such column: groups.icon_url"))
  );
}

/** GET /api/groups/[groupId] - グループ詳細取得 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupMember(groupId, userId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, color: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json<ApiError>(
        { error: "グループが見つかりません" },
        { status: 404 }
      );
    }

    const result: Group = {
      id: group.id,
      name: group.name,
      color: group.color,
      iconUrl: group.iconUrl ?? undefined,
      members: group.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        color: m.user.color,
        avatarUrl: m.user.avatarUrl ?? undefined,
        role: m.role,
      })),
    };
    return NextResponse.json<Group>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "このグループにアクセスする権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "グループ取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupRole(groupId, userId, [GroupRole.OWNER, GroupRole.ADMIN]);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json<ApiError>(
        { error: "リクエストボディが不正です" },
        { status: 400 }
      );
    }
    const data: { name?: string; color?: string; iconUrl?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim().length > 0) {
      data.name = body.name.trim();
    }
    if (typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      data.color = body.color;
    }
    if (body.iconUrl === null) {
      data.iconUrl = null;
    } else if (typeof body.iconUrl === "string") {
      data.iconUrl = body.iconUrl;
    }
    let group;
    try {
      group = await prisma.group.update({
        where: { id: groupId },
        data,
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, color: true, avatarUrl: true } },
            },
          },
        },
      });
    } catch (e) {
      if (!isUnknownIconUrlError(e)) throw e;
      const safeData = { ...data };
      delete safeData.iconUrl;
      group = await prisma.group.update({
        where: { id: groupId },
        data: safeData,
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, color: true, avatarUrl: true } },
            },
          },
        },
      });
    }

    const result: Group = {
      id: group.id,
      name: group.name,
      color: group.color,
      iconUrl: group.iconUrl ?? undefined,
      members: group.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        color: m.user.color,
        avatarUrl: m.user.avatarUrl ?? undefined,
        role: m.role,
      })),
    };
    return NextResponse.json<Group>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "グループを編集する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "グループ編集に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const userId = await requireAuthUserId(req);
    const { groupId } = await params;
    await assertGroupRole(groupId, userId, [GroupRole.OWNER]);
    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json<ApiError>(
        { error: "グループを削除する権限がありません" },
        { status: 403 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "グループ削除に失敗しました" },
      { status: 500 }
    );
  }
}

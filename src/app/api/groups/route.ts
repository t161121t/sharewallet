
import { NextRequest, NextResponse } from "next/server";
import type { Group, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { GroupRole } from "@/generated/prisma/client";

/** GET /api/groups - グループ一覧取得 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const groups = await prisma.group.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, color: true, avatarUrl: true } },
          },
        },
      },
    });

    const result: Group[] = groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      members: g.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        color: m.user.color,
        avatarUrl: m.user.avatarUrl ?? undefined,
        role: m.role,
      })),
    }));

    return NextResponse.json<Group[]>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "グループ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const body = await req.json().catch(() => null);
    if (!body?.name || typeof body.name !== "string") {
      return NextResponse.json<ApiError>(
        { error: "グループ名は必須です" },
        { status: 400 }
      );
    }
    const color =
      typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color)
        ? body.color
        : "#c9a227";

    const created = await prisma.group.create({
      data: {
        name: body.name.trim(),
        color,
        members: {
          create: [{ userId, role: GroupRole.OWNER }],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, color: true, avatarUrl: true } },
          },
        },
      },
    });

    const result: Group = {
      id: created.id,
      name: created.name,
      color: created.color,
      members: created.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        color: m.user.color,
        avatarUrl: m.user.avatarUrl ?? undefined,
        role: m.role,
      })),
    };
    return NextResponse.json<Group>(result, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "グループ作成に失敗しました" },
      { status: 500 }
    );
  }
}

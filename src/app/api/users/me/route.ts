import { NextRequest, NextResponse } from "next/server";
import type { UserProfile, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** GET /api/users/me - ユーザープロフィール取得 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json<UserProfile>({
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color,
      avatarUrl: user.avatarUrl ?? undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "プロフィールの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/** PUT /api/users/me - ユーザープロフィール更新 */
export async function PUT(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json<ApiError>(
        { error: "リクエストボディが不正です" },
        { status: 400 }
      );
    }

    if (body.email !== undefined && !EMAIL_PATTERN.test(body.email)) {
      return NextResponse.json<ApiError>(
        { error: "メールアドレスの形式が正しくありません" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      },
    });

    return NextResponse.json<UserProfile>({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      color: updated.color,
      avatarUrl: updated.avatarUrl ?? undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    if (isUniqueConstraintError(e)) {
      return NextResponse.json<ApiError>(
        { error: "このメールアドレスは既に使用されています" },
        { status: 409 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "プロフィールの更新に失敗しました" },
      { status: 500 }
    );
  }
}

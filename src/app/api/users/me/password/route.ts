import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

/** PUT /api/users/me/password - パスワード変更(現在のパスワードの照合が必要) */
export async function PUT(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);

    const body = await req.json().catch(() => null);
    if (
      !body ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string" ||
      !body.currentPassword ||
      !body.newPassword
    ) {
      return NextResponse.json<ApiError>(
        { error: "現在のパスワードと新しいパスワードを入力してください" },
        { status: 400 }
      );
    }

    if (body.newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json<ApiError>(
        { error: `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      body.currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return NextResponse.json<ApiError>(
        { error: "現在のパスワードが正しくありません" },
        { status: 401 }
      );
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return NextResponse.json<{ ok: boolean }>({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }
    return NextResponse.json<ApiError>(
      { error: "パスワードの変更に失敗しました" },
      { status: 500 }
    );
  }
}

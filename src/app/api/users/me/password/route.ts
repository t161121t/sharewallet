import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

/** PUT /api/users/me/password - パスワード変更(現在のパスワードの照合が必要) */
export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json<ApiError>(
      { error: "認証が必要です" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.currentPassword || !body.newPassword) {
    return NextResponse.json<ApiError>(
      { error: "現在のパスワードと新しいパスワードを入力してください" },
      { status: 400 }
    );
  }

  if (
    typeof body.newPassword !== "string" ||
    body.newPassword.length < MIN_PASSWORD_LENGTH
  ) {
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
}

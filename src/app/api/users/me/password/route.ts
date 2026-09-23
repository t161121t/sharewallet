import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { consumeRateLimit, tooManyRequestsResponse } from "@/lib/rateLimit";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  isPasswordLongEnough,
  isPasswordWithinBcryptLimit,
} from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";

// 本人(userId)単位: 認証Cookieを窃取した攻撃者が現在のパスワードを
// 総当たりするのを防ぐ。IPではなくuserIdで区切るのは、Cookieさえ
// あればどのIPからでも試行できてしまうため。
const CURRENT_PASSWORD_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

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

    if (!isPasswordLongEnough(body.newPassword)) {
      return NextResponse.json<ApiError>(
        { error: `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
        { status: 400 }
      );
    }
    if (!isPasswordWithinBcryptLimit(body.newPassword)) {
      return NextResponse.json<ApiError>(
        { error: `新しいパスワードは${MAX_PASSWORD_BYTES}バイト以下で入力してください` },
        { status: 400 }
      );
    }

    const rateCheck = await consumeRateLimit(
      `password-change:user:${userId}`,
      CURRENT_PASSWORD_LIMIT
    );
    if (!rateCheck.allowed) return tooManyRequestsResponse(rateCheck.retryAfterSeconds);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // verifyPassword内部でnormalizePassword(trim)してから照合する
    // (このPRより前に登録された、trimしていない生の値でハッシュ化された
    // 既存アカウントとの後方互換のため、正規化後の比較が失敗した場合は
    // 生の値でも一度だけ照合を試みる)。
    const isCurrentPasswordValid = await verifyPassword(
      body.currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      return NextResponse.json<ApiError>(
        { error: "現在のパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // hashPassword内部でnormalizePassword(trim)してからハッシュ化する。
    const passwordHash = await hashPassword(body.newPassword);
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

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { requireAuthUserId } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

// 本人(userId)単位: 認証Cookieを窃取した攻撃者が現在のパスワードを
// 総当たりするのを防ぐ。IPではなくuserIdで区切るのは、Cookieさえ
// あればどのIPからでも試行できてしまうため。
const CURRENT_PASSWORD_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json<ApiError>(
    { error: "試行回数が多すぎます。しばらく待ってから再度お試しください" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

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

    // 検証と保存を同じ値(trim後)で行う。ここでtrimした結果ではなく
    // body.newPasswordをそのままhashすると、末尾の空白などが検証を
    // すり抜けたままハッシュ化されてしまい、ログイン時に入力した値と
    // 一致しなくなる(意図せず自分をロックアウトする)。
    const newPassword = body.newPassword.trim();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json<ApiError>(
        { error: `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
        { status: 400 }
      );
    }

    const rateCheck = await consumeRateLimit(
      `password-change:user:${userId}`,
      CURRENT_PASSWORD_LIMIT
    );
    if (!rateCheck.allowed) return tooManyRequests(rateCheck.retryAfterSeconds);

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

    const passwordHash = await bcrypt.hash(newPassword, 10);
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

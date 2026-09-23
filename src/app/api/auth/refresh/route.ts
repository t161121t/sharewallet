import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import {
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  createToken,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth";

/**
 * POST /api/auth/refresh
 * リフレッシュトークン(Cookie)を検証し、新しいアクセストークンとリフレッシュトークンを発行する。
 * リフレッシュトークンは検証成功時に必ずローテーション(使い捨て)される。
 * 既に使用済みのトークンが再提示された場合(reuse)は、rotateRefreshToken内部で
 * そのユーザーの全トークンが失効させられ、ここでは通常の無効トークンと同様401を返す。
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) {
    return NextResponse.json<ApiError>(
      { error: "認証が必要です" },
      { status: 401 }
    );
  }

  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) {
    // 無効・期限切れのリフレッシュトークンだった場合は、中途半端に残ったCookieも掃除する
    const res = NextResponse.json<ApiError>(
      { error: "認証が必要です" },
      { status: 401 }
    );
    clearAuthCookies(res);
    return res;
  }

  const accessToken = await createToken(rotated.userId);
  const res = NextResponse.json<{ ok: boolean }>({ ok: true });
  setAuthCookies(res, accessToken, rotated.token);
  return res;
}

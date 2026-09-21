import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE_NAME, clearAuthCookies, revokeRefreshToken } from "@/lib/auth";

/** POST /api/auth/logout - 認証 Cookie を破棄し、リフレッシュトークンをDBから失効させる */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken).catch(() => undefined);
  }

  const res = NextResponse.json<{ ok: boolean }>({ ok: true });
  clearAuthCookies(res);
  return res;
}

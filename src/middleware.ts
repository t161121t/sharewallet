import { NextRequest, NextResponse } from "next/server";
import type { ApiError } from "@/types";
import { getAuthUserId } from "@/lib/auth-edge";

/**
 * `/api/**` への未認証アクセスを一括で弾くための早期拒否ゲート。
 *
 * 目的は「新しいAPIルートを追加した際に認証チェックを入れ忘れる」リスクを構造的に防ぐこと。
 * ただし、各ルートハンドラ側の `requireAuthUserId`/`getAuthUserId` 呼び出しは意図的に残している
 * (このmiddlewareでは可否判定のみ行い、実際に処理で使うuserIdの取得は引き続き各ルートに任せる)。
 * 理由:
 * - ルートによっては userId をレスポンスやDBクエリの条件として実際に使用しており、
 *   単純な「通す/弾く」の判定だけでは足りない。
 * - 17ルートすべての実装をmiddleware前提の設計(例: ヘッダー経由でuserIdを受け渡す)に
 *   一括で書き換えるのは変更範囲・リスクが大きく、既存の動作を壊す可能性がある。
 * そのため、認証チェックは「二重」になるが(JWT検証はコストの軽い処理であり、DBアクセスを
 * 伴わないため許容できると判断)、安全側に倒している。
 */

const PUBLIC_EXACT_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
]);

/** GET /api/invite/[token] (招待情報の閲覧)のみ未ログインでも許可する。 */
function isPublicInviteView(pathname: string, method: string): boolean {
  return method === "GET" && /^\/api\/invite\/[^/]+$/.test(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_EXACT_PATHS.has(pathname) ||
    isPublicInviteView(pathname, req.method)
  ) {
    return NextResponse.next();
  }

  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json<ApiError>(
      { error: "認証が必要です" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};

import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

/**
 * JWTの発行・検証・Cookie操作だけを行う、Prismaに依存しないモジュール。
 *
 * `src/middleware.ts`(Next.jsのEdgeランタイムで実行される)からも安全にimportできるよう、
 * DBアクセスを行う関数(`src/lib/auth.ts`の`getGroupMember`等)とは意図的に分離している。
 * `pg`(node-postgres)ベースのPrismaクライアントはEdgeランタイムで動作しないため、
 * このファイルは`@/lib/prisma`を絶対にimportしないこと。
 */

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production"
);
const ALG = "HS256";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日

/**
 * 認証トークンの Cookie 名。httpOnly のため JS(document.cookie)からは読めず、
 * XSSが発生してもこのCookieの値そのものを盗み出すことはできない。
 *
 * ただし、これはJWTの持ち出しを防ぐものであってXSSを無害化するものではない。
 * XSSされたページ内のスクリプトは、ブラウザが自動付与するこのCookieに乗じて
 * 同一オリジンのAPIを直接叩くことは引き続き可能(セッションライディング)。
 * XSS自体の混入経路を塞ぐ対策とあわせて考える必要がある。
 */
export const AUTH_COOKIE_NAME = "sharewallet_token";

/**
 * ログイン状態の「有無」だけを表す非機密フラグ。トークン本体は含まないため、
 * この値が読める/書き換えられても認可には影響しない(実際の検証は AUTH_COOKIE_NAME 側で行う)。
 * クライアント側の isAuthenticated() 判定にのみ使う。
 */
export const AUTH_PRESENCE_COOKIE_NAME = "sharewallet_authed";

/** JWT トークン生成 */
export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

/** JWT トークン検証 → userId を返す。失敗時は null */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/** ログイン成功時に認証 Cookie をレスポンスへ付与する */
export function setAuthCookies(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
  res.cookies.set(AUTH_PRESENCE_COOKIE_NAME, "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

/** ログアウト時に認証 Cookie を破棄する */
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(AUTH_PRESENCE_COOKIE_NAME, "", {
    httpOnly: false,
    path: "/",
    maxAge: 0,
  });
}

/** リクエストから認証ユーザー ID を取得(httpOnly Cookie ベース) */
export async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

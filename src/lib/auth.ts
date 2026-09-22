import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GroupRole } from "@/generated/prisma/client";

// 開発環境でのみ使う既知のデフォルト値。本番でこれが有効になると、
// 誰でもこの文字列でJWTを偽造しログイン状態を乗っ取れてしまうため、
// 本番(NODE_ENV=production)では絶対に使わせない(下のチェックでfail-closed)。
const DEV_ONLY_FALLBACK_SECRET = "dev-secret-change-in-production";

let cachedSecret: Uint8Array | null = null;

/**
 * JWTの署名/検証キーを取得する。あえてモジュール読み込み時ではなく、
 * ここ(初回のJWT生成/検証時)まで評価を遅らせている。`next build` は
 * ページデータ収集のために各 route ハンドラ経由でこのモジュールをimportするが、
 * 実際にトークンを扱うわけではないため、ビルド時に環境変数が参照できない
 * 構成(例: ビルド専用コンテナに実行時シークレットが渡らない構成)でも
 * ビルド自体は失敗させず、実際に使われる初回アクセス時にfail-closedさせる。
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const envSecret = process.env.JWT_SECRET;
  if (!envSecret && process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET が設定されていません。本番環境では既知のデフォルト値へのフォールバックを許可していないため、" +
        "環境変数 JWT_SECRET に十分な長さのランダムな値を設定してください。"
    );
  }

  cachedSecret = new TextEncoder().encode(envSecret ?? DEV_ONLY_FALLBACK_SECRET);
  return cachedSecret;
}

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
    .sign(getSecret());
}

/** JWT トークン検証 → userId を返す。失敗時は null */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
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

export async function requireAuthUserId(req: NextRequest): Promise<string> {
  const userId = await getAuthUserId(req);
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export async function getGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: {
      userId_groupId: { userId, groupId },
    },
  });
}

export async function assertGroupMember(groupId: string, userId: string) {
  const member = await getGroupMember(groupId, userId);
  if (!member) {
    throw new Error("FORBIDDEN");
  }
  return member;
}

export async function assertGroupRole(
  groupId: string,
  userId: string,
  allowedRoles: GroupRole[]
) {
  const member = await assertGroupMember(groupId, userId);
  if (!allowedRoles.includes(member.role)) {
    throw new Error("FORBIDDEN");
  }
  return member;
}

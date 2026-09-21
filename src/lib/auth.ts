import { randomBytes, createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GroupRole } from "@/generated/prisma/client";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production"
);
const ALG = "HS256";

/**
 * アクセストークン(JWT)の有効期限。
 * 短命にすることで、万一トークンが漏れた場合の悪用可能な時間を短く抑える。
 * 期限切れ後はリフレッシュトークンでの再発行(サイレントログイン継続)に任せるため、
 * 従来の7日固定に比べてUXは損なわない。
 */
const ACCESS_TOKEN_TTL_SECONDS = 60 * 30; // 30分
const ACCESS_TOKEN_TTL_JOSE = "30m";

/**
 * リフレッシュトークンの有効期限。この期間操作がなければ再ログインが必要になる。
 * アクセストークンよりずっと長く保つのがリフレッシュトークンの目的そのものなので、
 * 従来のアクセストークン有効期限(7日)よりもさらに長い30日とした。
 */
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30日

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

/**
 * リフレッシュトークンの Cookie 名。httpOnly。
 * `path: "/api/auth"` に限定して発行し、リフレッシュ・ログアウト以外のAPIリクエストには
 * 送信されないようにすることで、この長命なトークンが晒される範囲を最小限に絞っている。
 */
export const REFRESH_COOKIE_NAME = "sharewallet_refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";

/** アクセストークン(JWT)生成 */
export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL_JOSE)
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

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * リフレッシュトークンを新規発行しDBに保存する(ハッシュのみ保存)。
 * 生の値は呼び出し元がCookieとして返す用にのみ使う。
 */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

/**
 * リフレッシュトークンを検証し、有効なら「使い捨て」にして新しいトークンを発行し直す
 * (ローテーション)。同じトークンでの再利用(リプレイ)を防ぐため、検証成功時は
 * 古いトークンを必ず削除してから新しいトークンを発行する。
 *
 * 戻り値が null の場合(未登録・期限切れ)は呼び出し元で401として扱うこと。
 */
export async function rotateRefreshToken(
  oldToken: string
): Promise<{ userId: string; token: string } | null> {
  const oldHash = hashRefreshToken(oldToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: oldHash },
  });

  if (!existing) return null;

  // 期限切れ・有効いずれの場合も、この値は使い終わりなので必ず削除する
  await prisma.refreshToken.delete({ where: { id: existing.id } }).catch(() => undefined);

  if (existing.expiresAt <= new Date()) return null;

  const newToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, token: newToken };
}

/** ログアウト・失効時に特定のリフレッシュトークンをDBから削除する */
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

/** ログイン成功時・リフレッシュ成功時に認証 Cookie 一式をレスポンスへ付与する */
export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  // 「ログインしているか」の非機密フラグはリフレッシュトークンと同じ期間持たせる。
  // アクセストークンの30分に合わせてしまうと、リフレッシュでサイレントに継続できる
  // はずのセッションなのに、UI側が30分でログアウト扱いにしてしまうため。
  res.cookies.set(AUTH_PRESENCE_COOKIE_NAME, "1", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

/** ログアウト時に認証 Cookie 一式を破棄する */
export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
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

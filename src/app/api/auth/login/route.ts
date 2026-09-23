import { NextRequest, NextResponse } from "next/server";
import type { LoginResponse, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { createToken, issueRefreshToken, setAuthCookies } from "@/lib/auth";
import { consumeRateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rateLimit";
import { verifyPassword } from "@/lib/password";

// IP単位: 同一送信元からの総当たりを制限
const IP_LIMIT = { windowMs: 15 * 60 * 1000, max: 20 };
// メールアドレス単位: 分散した送信元から特定アカウントを狙う攻撃を制限
const EMAIL_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.email || !body.password) {
    return NextResponse.json<ApiError>(
      { error: "メールアドレスとパスワードを入力してください" },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  // 実際の認証(下の findUnique)がメールアドレスを大文字小文字区別のまま照合するため、
  // レート制限のキーも正規化(lowercase等)せず同じ表現を使う。ここで正規化してしまうと
  // 大文字小文字違いの別アカウント(DB上は別ユニーク値)同士が制限を共有してしまう。
  const email = String(body.email);

  const ipCheck = await consumeRateLimit(`login:ip:${ip}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooManyRequestsResponse(ipCheck.retryAfterSeconds);

  const emailCheck = await consumeRateLimit(`login:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooManyRequestsResponse(emailCheck.retryAfterSeconds);

  const user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  const passwordMatches = user ? await verifyPassword(body.password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    return NextResponse.json<ApiError>(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const accessToken = await createToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);

  const res = NextResponse.json<LoginResponse>({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  });
  setAuthCookies(res, accessToken, refreshToken);
  return res;
}

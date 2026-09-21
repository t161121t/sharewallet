import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { LoginResponse, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { createToken, setAuthCookies } from "@/lib/auth";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

// IP単位: 同一送信元からの総当たりを制限
const IP_LIMIT = { windowMs: 15 * 60 * 1000, max: 20 };
// メールアドレス単位: 分散した送信元から特定アカウントを狙う攻撃を制限
const EMAIL_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json<ApiError>(
    { error: "試行回数が多すぎます。しばらく待ってから再度お試しください" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.email || !body.password) {
    return NextResponse.json<ApiError>(
      { error: "メールアドレスとパスワードを入力してください" },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const email = String(body.email).toLowerCase();

  const ipCheck = await consumeRateLimit(`login:ip:${ip}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooManyRequests(ipCheck.retryAfterSeconds);

  const emailCheck = await consumeRateLimit(`login:email:${email}`, EMAIL_LIMIT);
  if (!emailCheck.allowed) return tooManyRequests(emailCheck.retryAfterSeconds);

  const user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return NextResponse.json<ApiError>(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await createToken(user.id);

  const res = NextResponse.json<LoginResponse>({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  });
  setAuthCookies(res, token);
  return res;
}

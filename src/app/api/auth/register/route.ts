import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { RegisterResponse, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rateLimit";
import { MIN_PASSWORD_LENGTH, normalizePassword } from "@/lib/validation";

// IP単位: 大量アカウント自動作成(登録フォームへの総当たり)を制限
const IP_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.name || !body.email || !body.password) {
    return NextResponse.json<ApiError>(
      { error: "名前、メールアドレス、パスワードを入力してください" },
      { status: 400 }
    );
  }

  if (typeof body.password !== "string") {
    return NextResponse.json<ApiError>(
      { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
      { status: 400 }
    );
  }

  // 検証とハッシュ化を同じ値(normalizePassword後)で行う。正規化前の
  // body.passwordをそのままhashすると、末尾の空白などが検証を
  // すり抜けたままハッシュ化され、ログイン時に入力した値と一致しなくなる。
  const password = normalizePassword(body.password);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json<ApiError>(
      { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const ipCheck = await consumeRateLimit(`register:ip:${ip}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooManyRequestsResponse(ipCheck.retryAfterSeconds);

  // email 重複チェック
  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });
  if (existing) {
    return NextResponse.json<ApiError>(
      { error: "このメールアドレスは既に登録されています" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
    },
  });

  return NextResponse.json<RegisterResponse>({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      color: user.color,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { RegisterResponse, ApiError } from "@/types";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

// IP単位: 大量アカウント自動作成(登録フォームへの総当たり)を制限
const IP_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json<ApiError>(
    { error: "試行回数が多すぎます。しばらく待ってから再度お試しください" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.name || !body.email || !body.password) {
    return NextResponse.json<ApiError>(
      { error: "名前、メールアドレス、パスワードを入力してください" },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const ipCheck = await consumeRateLimit(`register:ip:${ip}`, IP_LIMIT);
  if (!ipCheck.allowed) return tooManyRequests(ipCheck.retryAfterSeconds);

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

  const passwordHash = await bcrypt.hash(body.password, 10);

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

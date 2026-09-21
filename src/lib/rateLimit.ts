import { prisma } from "@/lib/prisma";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type RateLimitOptions = {
  /** カウントをリセットするまでの時間(ミリ秒) */
  windowMs: number;
  /** windowMs 内に許可する最大試行回数 */
  max: number;
};

/**
 * key ごとに固定ウィンドウ方式で試行回数を数え、max を超えたらブロックする。
 *
 * 注意: read → write の間はアトミックではないため、同時多発リクエストでは
 * ごく僅かに max を超えて通過し得る(レースコンディション)。ログイン試行程度の
 * 頻度・規模のアプリではこのトレードオフは許容範囲と判断している。
 * 厳密なアトミック性が必要になった場合は生SQLでの原子的な upsert に置き換える。
 */
export async function consumeRateLimit(
  key: string,
  { windowMs, max }: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const entry = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!entry || entry.expiresAt <= now) {
    await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, expiresAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, expiresAt: new Date(now.getTime() + windowMs) },
    });
    return { allowed: true };
  }

  if (entry.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.expiresAt.getTime() - now.getTime()) / 1000)
      ),
    };
  }

  await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true };
}

/** リクエストからクライアントIPを取得する(プロキシ経由を想定しヘッダーから読む) */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

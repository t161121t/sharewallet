import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { probabilisticCleanup } from "@/lib/cleanup";
import type { ApiError } from "@/types";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** レート制限超過時の429レスポンス(login/register/password-changeで共通利用) */
export function tooManyRequestsResponse(retryAfterSeconds: number) {
  return NextResponse.json<ApiError>(
    { error: "試行回数が多すぎます。しばらく待ってから再度お試しください" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

type RateLimitOptions = {
  /** カウントをリセットするまでの時間(ミリ秒) */
  windowMs: number;
  /** windowMs 内に許可する最大試行回数 */
  max: number;
};

/**
 * key ごとに固定ウィンドウ方式で試行回数を数え、max を超えたらブロックする。
 *
 * カウンタの読み取り→更新は PostgreSQL の `INSERT ... ON CONFLICT DO UPDATE` 1文で
 * 原子的に行っている。read-then-write を素朴に(findUnique → upsert/update の2ステップで)
 * 実装すると、ウィンドウの先頭や期限切れ直後に複数リクエストが同時に来た場合、
 * 全リクエストが「まだ存在しない/期限切れ」と観測してそれぞれ count を 1 にリセットしてしまい、
 * レート制限が実質的に機能しなくなる(バーストで突破される)ため、DB側の1操作に寄せている。
 */
export async function consumeRateLimit(
  key: string,
  { windowMs, max }: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + windowMs);

  await probabilisticCleanup(() =>
    prisma.rateLimitEntry.deleteMany({ where: { expiresAt: { lt: now } } })
  );

  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>(
    Prisma.sql`
      INSERT INTO "rate_limit_entries" ("id", "key", "count", "expires_at", "created_at")
      VALUES (${randomUUID()}, ${key}, 1, ${newExpiresAt}, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "rate_limit_entries"."expires_at" <= now() THEN 1
          ELSE "rate_limit_entries"."count" + 1
        END,
        "expires_at" = CASE
          WHEN "rate_limit_entries"."expires_at" <= now() THEN ${newExpiresAt}
          ELSE "rate_limit_entries"."expires_at"
        END
      RETURNING "count", "expires_at" AS "expiresAt"
    `
  );

  const row = rows[0];
  if (!row) {
    // INSERT ... RETURNING が1行返らないケースは通常起こり得ないが、
    // 万が一に備えてフェイルオープン(許可)側に倒す。
    return { allowed: true };
  }

  if (row.count > max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((new Date(row.expiresAt).getTime() - now.getTime()) / 1000)
      ),
    };
  }

  return { allowed: true };
}

/**
 * リクエストからクライアントIPを取得する(プロキシ経由を想定しヘッダーから読む)。
 *
 * 信頼境界についての注意: `x-forwarded-for` はクライアントが任意の値を送信できるヘッダーであり、
 * このIPをそのまま信用できるのは、アプリの手前にいるリバースプロキシ/エッジ(Vercel等)が
 * クライアントから受け取った値を上書き・正規化し、実際の送信元IPだけを追記する構成になっている
 * 場合に限る。そのような信頼できるプロキシを経由しない構成(直接インターネットに公開する等)では、
 * このヘッダーは偽装可能でありIP単位のレート制限は回避され得る。導入先の実際のネットワーク構成で
 * このヘッダーが上書きされることを確認した上で使用すること。
 */
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

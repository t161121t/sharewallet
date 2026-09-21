import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockQueryRaw, mockDeleteMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    rateLimitEntry: {
      deleteMany: mockDeleteMany,
    },
  },
}));

import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

describe("consumeRateLimit", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockDeleteMany.mockReset();
    mockDeleteMany.mockResolvedValue({ count: 0 });
    // 掃除処理は確率的に走るため、テストを決定的にするためRandomを固定(掃除を発生させない)
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("上限未満(INSERT/リセット直後を含む)なら許可する", async () => {
    mockQueryRaw.mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("上限ちょうどでは許可する(maxを超えて初めてブロック)", async () => {
    mockQueryRaw.mockResolvedValue([
      { count: 3, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(true);
  });

  it("上限を超えた場合はブロックしretryAfterSecondsを返す", async () => {
    mockQueryRaw.mockResolvedValue([
      { count: 4, expiresAt: new Date(Date.now() + 30_000) },
    ]);

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("$queryRawが空配列を返した場合はフェイルオープンで許可する", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(true);
  });

  it("低確率の掃除処理が失敗してもレート制限の判定自体は継続する", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockDeleteMany.mockRejectedValue(new Error("db error"));
    mockQueryRaw.mockResolvedValue([
      { count: 1, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(true);
    expect(mockDeleteMany).toHaveBeenCalled();
  });
});

describe("getClientIp", () => {
  it("x-forwarded-for の先頭IPを返す", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("x-forwarded-for がなければ x-real-ip を返す", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(getClientIp(req)).toBe("203.0.113.9");
  });

  it("どちらも無ければ unknown を返す", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(getClientIp(req)).toBe("unknown");
  });
});

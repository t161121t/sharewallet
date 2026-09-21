import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockFindUnique, mockUpsert, mockUpdate } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    rateLimitEntry: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      update: mockUpdate,
    },
  },
}));

import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";

describe("consumeRateLimit", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockUpdate.mockReset();
  });

  it("エントリが存在しない場合は許可し、count=1で作成する", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({});

    const result = await consumeRateLimit("k1", { windowMs: 1000, max: 3 });

    expect(result.allowed).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "k1" },
        create: expect.objectContaining({ key: "k1", count: 1 }),
      })
    );
  });

  it("ウィンドウが期限切れの場合は許可し、カウントをリセットする", async () => {
    mockFindUnique.mockResolvedValue({
      key: "k1",
      count: 99,
      expiresAt: new Date(Date.now() - 1000),
    });
    mockUpsert.mockResolvedValue({});

    const result = await consumeRateLimit("k1", { windowMs: 1000, max: 3 });

    expect(result.allowed).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("上限未満なら許可しカウントを増やす", async () => {
    mockFindUnique.mockResolvedValue({
      key: "k1",
      count: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockUpdate.mockResolvedValue({});

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { key: "k1" },
      data: { count: { increment: 1 } },
    });
  });

  it("上限に達している場合はブロックしretryAfterSecondsを返す", async () => {
    mockFindUnique.mockResolvedValue({
      key: "k1",
      count: 3,
      expiresAt: new Date(Date.now() + 30_000),
    });

    const result = await consumeRateLimit("k1", { windowMs: 60_000, max: 3 });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
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

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockConsumeRateLimit, mockRotateRefreshToken, mockCreateToken } = vi.hoisted(() => ({
  mockConsumeRateLimit: vi.fn(),
  mockRotateRefreshToken: vi.fn(),
  mockCreateToken: vi.fn(),
}));

vi.mock("@/lib/rateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rateLimit")>("@/lib/rateLimit");
  return {
    ...actual,
    consumeRateLimit: mockConsumeRateLimit,
    getClientIp: () => "127.0.0.1",
  };
});

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    rotateRefreshToken: mockRotateRefreshToken,
    createToken: mockCreateToken,
  };
});

import { POST } from "./route";

const URL = "http://localhost/api/auth/refresh";

function requestWithRefreshCookie(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("Cookie", `sharewallet_refresh_token=${token}`);
  }
  return new NextRequest(URL, { method: "POST", headers });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeRateLimit.mockResolvedValue({ allowed: true });
  });

  it("IP単位の試行回数が上限を超えたら429を返す(Cookieの有無を見る前に弾く)", async () => {
    mockConsumeRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    const res = await POST(requestWithRefreshCookie("some-token"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mockRotateRefreshToken).not.toHaveBeenCalled();
  });

  it("リフレッシュトークンCookieが無ければ401を返す", async () => {
    const res = await POST(requestWithRefreshCookie(undefined));

    expect(res.status).toBe(401);
    expect(mockRotateRefreshToken).not.toHaveBeenCalled();
  });

  it("ローテーションが失敗(無効・期限切れ・reuse検知)したら401を返しCookieを破棄する", async () => {
    mockRotateRefreshToken.mockResolvedValue(null);

    const res = await POST(requestWithRefreshCookie("invalid-token"));

    expect(res.status).toBe(401);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sharewallet_token=;");
  });

  it("ローテーションが成功したら新しいアクセストークン・リフレッシュトークンをCookieにセットする", async () => {
    mockRotateRefreshToken.mockResolvedValue({ userId: "user-1", token: "new-refresh-token" });
    mockCreateToken.mockResolvedValue("new-access-token");

    const res = await POST(requestWithRefreshCookie("valid-token"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockCreateToken).toHaveBeenCalledWith("user-1");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sharewallet_token=new-access-token");
  });
});

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, createToken } from "@/lib/auth-edge";
import { middleware } from "@/middleware";

function requestTo(
  path: string,
  options: { method?: string; token?: string } = {}
): NextRequest {
  const headers = new Headers();
  if (options.token) {
    headers.set("Cookie", `${AUTH_COOKIE_NAME}=${options.token}`);
  }
  return new NextRequest(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
  });
}

describe("middleware", () => {
  it("認証Cookieがない保護されたAPIへのアクセスは401", async () => {
    const res = await middleware(requestTo("/api/users/me"));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
  });

  it("不正なCookieでも401", async () => {
    const res = await middleware(
      requestTo("/api/users/me", { token: "not-a-valid-jwt" })
    );
    expect(res.status).toBe(401);
  });

  it("有効な認証Cookieがあれば通過する(next())", async () => {
    const token = await createToken("user-1");
    const res = await middleware(
      requestTo("/api/users/me", { token })
    );
    // NextResponse.next() は 200 相当のパススルーレスポンスを返す
    expect(res.status).toBe(200);
  });

  it.each([
    "/api/health",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/logout",
  ])("公開パス %s は未認証でも通過する", async (path) => {
    const res = await middleware(requestTo(path, { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("GET /api/invite/[token] は未認証でも通過する(招待情報の閲覧)", async () => {
    const res = await middleware(requestTo("/api/invite/some-token"));
    expect(res.status).toBe(200);
  });

  it("POST /api/invite/[token]/accept は未認証だと401(参加には認証が必要)", async () => {
    const res = await middleware(
      requestTo("/api/invite/some-token/accept", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });
});

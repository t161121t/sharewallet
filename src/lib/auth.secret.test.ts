import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const ORIGINAL_ENV = { ...process.env };

describe("JWT_SECRET のフォールバック(fail-closed)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("本番環境でJWT_SECRET未設定でもモジュールの読み込み自体は成功する(next build対策)", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.JWT_SECRET;

    await expect(import("@/lib/auth")).resolves.toBeDefined();
  });

  it("本番環境でJWT_SECRET未設定なら初回のトークン生成時に例外を投げる", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.JWT_SECRET;

    const { createToken } = await import("@/lib/auth");
    await expect(createToken("user-1")).rejects.toThrow("JWT_SECRET");
  });

  it("本番環境でもJWT_SECRETが設定されていればトークンを生成できる", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.JWT_SECRET = "a-sufficiently-long-random-secret";

    const { createToken } = await import("@/lib/auth");
    await expect(createToken("user-1")).resolves.toEqual(expect.any(String));
  });

  it("開発環境ではJWT_SECRET未設定でも既知のデフォルト値にフォールバックしてトークンを生成できる", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    delete process.env.JWT_SECRET;

    const { createToken } = await import("@/lib/auth");
    await expect(createToken("user-1")).resolves.toEqual(expect.any(String));
  });
});

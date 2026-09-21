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

  it("本番環境でJWT_SECRET未設定なら読み込み時に例外を投げる", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.JWT_SECRET;

    await expect(import("@/lib/auth")).rejects.toThrow("JWT_SECRET");
  });

  it("本番環境でもJWT_SECRETが設定されていれば読み込める", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.JWT_SECRET = "a-sufficiently-long-random-secret";

    await expect(import("@/lib/auth")).resolves.toBeDefined();
  });

  it("開発環境ではJWT_SECRET未設定でも既知のデフォルト値にフォールバックして読み込める", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    delete process.env.JWT_SECRET;

    await expect(import("@/lib/auth")).resolves.toBeDefined();
  });
});

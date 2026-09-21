import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest } from "@/test/helpers";

const { mockFindUnique, mockUpdate, mockRequireAuthUserId } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockRequireAuthUserId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuthUserId: mockRequireAuthUserId,
}));

import { GET, PUT } from "./route";

const USER_ID = "user-1";
const URL = "http://localhost/api/users/me";

describe("GET /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証は 401 を返す", async () => {
    mockRequireAuthUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await GET(createJsonRequest(URL));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
  });

  it("ユーザーが存在しない場合は 404 を返す", async () => {
    mockRequireAuthUserId.mockResolvedValue(USER_ID);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(createJsonRequest(URL));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "ユーザーが見つかりません" });
  });

  it("想定外のDBエラーは 500 の ApiError 形式で返す", async () => {
    mockRequireAuthUserId.mockResolvedValue(USER_ID);
    mockFindUnique.mockRejectedValue(new Error("db down"));

    const res = await GET(createJsonRequest(URL));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "プロフィールの取得に失敗しました",
    });
  });
});

describe("PUT /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthUserId.mockResolvedValue(USER_ID);
  });

  it("未認証は 401 を返す", async () => {
    mockRequireAuthUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await PUT(
      createJsonRequest(URL, { method: "PUT", body: { name: "太郎" } })
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("メールアドレスの形式が不正なら 400 を返す", async () => {
    const res = await PUT(
      createJsonRequest(URL, { method: "PUT", body: { email: "not-an-email" } })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "メールアドレスの形式が正しくありません",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("重複するメールアドレスに更新しようとすると 409 を返す(P2002を握りつぶさない)", async () => {
    mockUpdate.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { email: "taken@example.com" },
      })
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "このメールアドレスは既に使用されています",
    });
  });

  it("想定外のDBエラーはスタックトレースを漏らさず 500 の ApiError 形式で返す", async () => {
    mockUpdate.mockRejectedValue(new Error("db down"));

    const res = await PUT(
      createJsonRequest(URL, { method: "PUT", body: { name: "太郎" } })
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "プロフィールの更新に失敗しました",
    });
  });

  it("有効な入力は更新後のプロフィールを返す", async () => {
    mockUpdate.mockResolvedValue({
      id: USER_ID,
      name: "新しい名前",
      email: "new@example.com",
      color: "#c9a227",
      avatarUrl: null,
    });

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { name: "新しい名前", email: "new@example.com" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: USER_ID,
      name: "新しい名前",
      email: "new@example.com",
      color: "#c9a227",
      avatarUrl: undefined,
    });
  });
});

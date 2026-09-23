import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest } from "@/test/helpers";

const {
  mockFindUnique,
  mockUpdate,
  mockRequireAuthUserId,
  mockCompare,
  mockHash,
  mockConsumeRateLimit,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockRequireAuthUserId: vi.fn(),
  mockCompare: vi.fn(),
  mockHash: vi.fn(),
  mockConsumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuthUserId: mockRequireAuthUserId,
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mockCompare, hash: mockHash },
}));

vi.mock("@/lib/rateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rateLimit")>("@/lib/rateLimit");
  return {
    ...actual,
    consumeRateLimit: mockConsumeRateLimit,
  };
});

import { PUT } from "./route";

const USER_ID = "user-1";
const URL = "http://localhost/api/users/me/password";

describe("PUT /api/users/me/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthUserId.mockResolvedValue(USER_ID);
    mockConsumeRateLimit.mockResolvedValue({ allowed: true });
  });

  it("未認証は401を返す", async () => {
    mockRequireAuthUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("currentPassword/newPasswordが無いと400を返す", async () => {
    const res = await PUT(createJsonRequest(URL, { method: "PUT", body: {} }));

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("currentPasswordが文字列以外(配列)なら400を返す", async () => {
    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: ["old-pass"], newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(400);
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("新しいパスワードが8文字未満だと400を返す", async () => {
    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "short" },
      })
    );

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("新しいパスワードが空白のみなら400を返す(trim後の長さで判定)", async () => {
    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "        " },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "新しいパスワードは8文字以上で入力してください",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("新しいパスワードが正規化後に72バイトを超えると400を返す", async () => {
    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        // 「あ」はUTF-8で3バイトなので25文字は75バイトになる。
        body: { currentPassword: "old-pass", newPassword: "あ".repeat(25) },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "新しいパスワードは72バイト以下で入力してください",
    });
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("試行回数が上限を超えたら429を返す", async () => {
    mockConsumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mockCompare).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ユーザーが存在しない場合404を返す", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(404);
  });

  it("現在のパスワードが誤っている場合401を返し更新しない", async () => {
    mockFindUnique.mockResolvedValue({ id: USER_ID, passwordHash: "stored-hash" });
    mockCompare.mockResolvedValue(false);

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "wrong-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(401);
    expect(mockCompare).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("currentPasswordの正規化後の照合が失敗しても、生の値での照合(後方互換)が成功すれば通る", async () => {
    // このPRより前に変更されたパスワードは、trimしていない生の値で
    // ハッシュ化されている可能性がある。
    mockFindUnique.mockResolvedValue({ id: USER_ID, passwordHash: "stored-hash" });
    mockCompare.mockResolvedValueOnce(false); // 1回目: normalizePassword後の値
    mockCompare.mockResolvedValueOnce(true); // 2回目: 生の値(後方互換フォールバック)
    mockHash.mockResolvedValue("new-hash");
    mockUpdate.mockResolvedValue({});

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass ", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(200);
    expect(mockCompare).toHaveBeenNthCalledWith(1, "old-pass", "stored-hash");
    expect(mockCompare).toHaveBeenNthCalledWith(2, "old-pass ", "stored-hash");
  });

  it("新しいパスワードの末尾に空白があっても、検証と保存で同じ(trim後の)値を使う", async () => {
    mockFindUnique.mockResolvedValue({ id: USER_ID, passwordHash: "stored-hash" });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("new-hash");
    mockUpdate.mockResolvedValue({});

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123 " },
      })
    );

    expect(res.status).toBe(200);
    // trim前の"new-pass-123 "ではなく、trim後の"new-pass-123"がhashされること
    // (末尾の空白を含んだままハッシュ化すると、次回ログイン時に入力した値と
    // 一致せず自分をロックアウトしてしまう)
    expect(mockHash).toHaveBeenCalledWith("new-pass-123", 10);
  });

  it("想定外のDBエラーはスタックトレースを漏らさず500のApiError形式で返す", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "パスワードの変更に失敗しました",
    });
  });

  it("正しい入力ならパスワードを更新して200を返す", async () => {
    mockFindUnique.mockResolvedValue({ id: USER_ID, passwordHash: "stored-hash" });
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("new-hash");
    mockUpdate.mockResolvedValue({});

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockConsumeRateLimit).toHaveBeenCalledWith(
      `password-change:user:${USER_ID}`,
      expect.any(Object)
    );
    expect(mockCompare).toHaveBeenCalledWith("old-pass", "stored-hash");
    expect(mockHash).toHaveBeenCalledWith("new-pass-123", 10);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { passwordHash: "new-hash" },
    });
  });
});

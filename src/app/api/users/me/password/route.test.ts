import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest } from "@/test/helpers";

const { mockFindUnique, mockUpdate, mockGetAuthUserId, mockCompare, mockHash } =
  vi.hoisted(() => ({
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetAuthUserId: vi.fn(),
    mockCompare: vi.fn(),
    mockHash: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthUserId: mockGetAuthUserId,
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mockCompare, hash: mockHash },
}));

import { PUT } from "./route";

const USER_ID = "user-1";
const URL = "http://localhost/api/users/me/password";

describe("PUT /api/users/me/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証は401を返す", async () => {
    mockGetAuthUserId.mockResolvedValue(null);

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("currentPassword/newPasswordが無いと400を返す", async () => {
    mockGetAuthUserId.mockResolvedValue(USER_ID);

    const res = await PUT(createJsonRequest(URL, { method: "PUT", body: {} }));

    expect(res.status).toBe(400);
  });

  it("新しいパスワードが8文字未満だと400を返す", async () => {
    mockGetAuthUserId.mockResolvedValue(USER_ID);

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "old-pass", newPassword: "short" },
      })
    );

    expect(res.status).toBe(400);
  });

  it("ユーザーが存在しない場合404を返す", async () => {
    mockGetAuthUserId.mockResolvedValue(USER_ID);
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
    mockGetAuthUserId.mockResolvedValue(USER_ID);
    mockFindUnique.mockResolvedValue({ id: USER_ID, passwordHash: "stored-hash" });
    mockCompare.mockResolvedValue(false);

    const res = await PUT(
      createJsonRequest(URL, {
        method: "PUT",
        body: { currentPassword: "wrong-pass", newPassword: "new-pass-123" },
      })
    );

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("正しい入力ならパスワードを更新して200を返す", async () => {
    mockGetAuthUserId.mockResolvedValue(USER_ID);
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
    expect(mockCompare).toHaveBeenCalledWith("old-pass", "stored-hash");
    expect(mockHash).toHaveBeenCalledWith("new-pass-123", 10);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { passwordHash: "new-hash" },
    });
  });
});

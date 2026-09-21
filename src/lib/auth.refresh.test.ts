import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockCreate, mockDelete, mockDeleteMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      findUnique: mockFindUnique,
      create: mockCreate,
      delete: mockDelete,
      deleteMany: mockDeleteMany,
    },
  },
}));

import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "@/lib/auth";

describe("issueRefreshToken", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({});
  });

  it("ランダムなトークンを発行し、ハッシュ化した値をDBに保存する(生の値は保存しない)", async () => {
    const token = await issueRefreshToken("user-1");

    expect(token).toEqual(expect.any(String));
    expect(token.length).toBeGreaterThan(20);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.data.userId).toBe("user-1");
    expect(arg.data.tokenHash).not.toBe(token);
    expect(arg.data.expiresAt).toBeInstanceOf(Date);
    expect(arg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("呼び出すたびに異なるトークンを発行する", async () => {
    const a = await issueRefreshToken("user-1");
    const b = await issueRefreshToken("user-1");
    expect(a).not.toBe(b);
  });
});

describe("rotateRefreshToken", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCreate.mockReset();
    mockDelete.mockReset();
    mockCreate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  it("未登録のトークンは null を返す", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await rotateRefreshToken("unknown-token");

    expect(result).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("期限切れのトークンは削除した上で null を返す(リプレイ防止のため使い捨てにする)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await rotateRefreshToken("expired-token");

    expect(result).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "rt-1" } });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("有効なトークンは古い行を削除し、新しいトークンを発行して返す", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await rotateRefreshToken("valid-token");

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "rt-1" } });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.token).toEqual(expect.any(String));
    expect(result?.token).not.toBe("valid-token");
  });
});

describe("revokeRefreshToken", () => {
  it("トークンのハッシュでdeleteManyを呼ぶ", async () => {
    mockDeleteMany.mockReset();
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await revokeRefreshToken("some-token");

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const arg = mockDeleteMany.mock.calls[0][0];
    expect(arg.where.tokenHash).not.toBe("some-token");
    expect(typeof arg.where.tokenHash).toBe("string");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockCreate, mockUpdate, mockUpdateMany, mockDeleteMany } = vi.hoisted(
  () => ({
    mockFindUnique: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockUpdateMany: vi.fn(),
    mockDeleteMany: vi.fn(),
  })
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

import {
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "@/lib/auth";

describe("issueRefreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockDeleteMany.mockResolvedValue({ count: 0 });
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
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("未登録のトークンは null を返す", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await rotateRefreshToken("unknown-token");

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("期限切れのトークンは使用済みにマークした上で null を返す(リプレイ防止のため使い捨てにする)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("expired-token");

    expect(result).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("有効なトークンは使用済みにマークしてから、新しいトークンを発行して返す", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("valid-token");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.token).toEqual(expect.any(String));
    expect(result?.token).not.toBe("valid-token");
  });

  it("既に使用済み(revokedAt有り)のトークンが再提示されたら、そのユーザーの全トークンを失効させてnullを返す(reuse検知)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(Date.now() - 1000), // 既に使用済み
    });

    const result = await rotateRefreshToken("reused-token");

    expect(result).toBeNull();
    // 個別のupdateではなく、そのユーザー全体をrevokeAllRefreshTokensForUser経由で失効させる
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    // reuseを検知した1件自体を個別にupdateし直すことはない(既にrevokedAt済みのため)
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("revokeRefreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("トークンのハッシュでupdateManyを呼び、使用済みにマークする(削除はしない)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await revokeRefreshToken("some-token");

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const arg = mockUpdateMany.mock.calls[0][0];
    expect(arg.where.tokenHash).not.toBe("some-token");
    expect(typeof arg.where.tokenHash).toBe("string");
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.data.revokedAt).toBeInstanceOf(Date);
  });
});

describe("revokeAllRefreshTokensForUser", () => {
  it("指定ユーザーの未失効トークンを全てupdateManyで失効させる", async () => {
    mockUpdateMany.mockReset();
    mockUpdateMany.mockResolvedValue({ count: 3 });

    await revokeAllRefreshTokensForUser("user-1");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

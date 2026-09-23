import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockCreate, mockUpdateMany, mockDeleteMany } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      findUnique: mockFindUnique,
      create: mockCreate,
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

  it("sessionStartedAtを省略した場合、現在時刻を新しいセッション開始時刻として保存する(新規ログイン扱い)", async () => {
    const before = Date.now();
    await issueRefreshToken("user-1");
    const after = Date.now();

    const arg = mockCreate.mock.calls[0][0];
    expect(arg.data.sessionStartedAt).toBeInstanceOf(Date);
    expect(arg.data.sessionStartedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(arg.data.sessionStartedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("sessionStartedAtを渡した場合、その値をそのまま保存する(ローテーション時の引き継ぎ)", async () => {
    const original = new Date(Date.now() - 60 * 60 * 1000);
    await issueRefreshToken("user-1", original);

    const arg = mockCreate.mock.calls[0][0];
    expect(arg.data.sessionStartedAt).toBe(original);
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
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("未登録のトークンは null を返す", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await rotateRefreshToken("unknown-token");

    expect(result).toBeNull();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("有効なトークンは、WHERE revokedAt IS NULL 条件付きのupdateManyで使用済みにマークしてから新しいトークンを発行する", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      sessionStartedAt: new Date(),
      revokedAt: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 }); // 自分自身の失効(アトミック)

    const result = await rotateRefreshToken("valid-token");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "rt-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    expect(result?.token).toEqual(expect.any(String));
    expect(result?.token).not.toBe("valid-token");
  });

  it("ローテーションで発行する新トークンは、元のsessionStartedAtを引き継ぐ(絶対有効期限の起点を保つ)", async () => {
    const sessionStartedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10日前にログイン
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      sessionStartedAt,
      revokedAt: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    await rotateRefreshToken("valid-token");

    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.sessionStartedAt).toBe(sessionStartedAt);
  });

  it("期限切れ(expiresAt超過)のトークンは使用済みにマークするが、新トークンは発行せず null を返す", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      sessionStartedAt: new Date(),
      revokedAt: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await rotateRefreshToken("expired-token");

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("絶対有効期限(90日)を超えたセッションは、期限内でも新トークンを発行せず null を返す", async () => {
    const sessionStartedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91日前
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000), // スライディングウィンドウ自体はまだ有効
      sessionStartedAt,
      revokedAt: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await rotateRefreshToken("old-session-token");

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("既に使用済み(updateManyのcountが0)のトークンが再提示されたら、そのユーザーの全トークンを失効させてnullを返す(reuse検知)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      sessionStartedAt: new Date(),
      revokedAt: new Date(Date.now() - 1000), // 既に使用済み
    });
    // 自分自身への条件付きupdateManyはヒットしない(既にrevokedAt済みのため)
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockUpdateMany.mockResolvedValueOnce({ count: 3 }); // revokeAllRefreshTokensForUser側

    const result = await rotateRefreshToken("reused-token");

    expect(result).toBeNull();
    expect(mockUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "rt-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("同時に2つのリクエストが同じトークンでローテーションしようとした場合、片方だけが成功する(競合を模擬)", async () => {
    // 2つのリクエストがどちらも同じ「まだrevokedAtはnull」という行をfindUniqueで読む
    const row = {
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      sessionStartedAt: new Date(),
      revokedAt: null,
    };
    mockFindUnique.mockResolvedValue(row);
    // アトミックなupdateManyでは、先に実行された方だけがcount:1を得て、
    // 後から実行された方はcount:0になる(DB側の行ロックで保証される)。
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // 1つ目のリクエスト: 成功
      .mockResolvedValueOnce({ count: 0 }) // 2つ目のリクエスト: 既に消費済みと判定
      .mockResolvedValueOnce({ count: 1 }); // 2つ目がreuse検知でrevokeAllRefreshTokensForUserを呼ぶ

    const [first, second] = await Promise.all([
      rotateRefreshToken("same-token"),
      rotateRefreshToken("same-token"),
    ]);

    const results = [first, second];
    const succeeded = results.filter((r) => r !== null);
    const failed = results.filter((r) => r === null);
    // 両方成功する(=同じ古いトークンから2つの有効な新トークンが生まれる)ことは無く、
    // ちょうど1つだけが成功する。
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);
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

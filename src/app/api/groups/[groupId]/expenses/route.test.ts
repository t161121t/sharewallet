import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest, routeParams } from "@/test/helpers";

const {
  mockFindMany,
  mockCreate,
  mockExpenseFindMany,
  mockRequireAuthUserId,
  mockAssertGroupMember,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockExpenseFindMany: vi.fn(),
  mockRequireAuthUserId: vi.fn(),
  mockAssertGroupMember: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: { findMany: mockFindMany },
    expense: { create: mockCreate, findMany: mockExpenseFindMany },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuthUserId: mockRequireAuthUserId,
  assertGroupMember: mockAssertGroupMember,
}));

import { GET, POST } from "./route";

const GROUP_ID = "group-1";
const USER_A = "user-a";
const USER_B = "user-b";
const BASE_URL = `http://localhost/api/groups/${GROUP_ID}/expenses`;
const params = routeParams({ groupId: GROUP_ID });

function setupAuthenticatedMember() {
  mockRequireAuthUserId.mockResolvedValue(USER_A);
  mockAssertGroupMember.mockResolvedValue({ userId: USER_A, groupId: GROUP_ID });
  mockFindMany.mockResolvedValue([{ userId: USER_A }, { userId: USER_B }]);
}

describe("GET /api/groups/[groupId]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証は 401 を返す", async () => {
    mockRequireAuthUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await GET(createJsonRequest(BASE_URL), params);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
  });

  it("非メンバーは 403 を返す", async () => {
    mockRequireAuthUserId.mockResolvedValue("outsider");
    mockAssertGroupMember.mockRejectedValue(new Error("FORBIDDEN"));

    const res = await GET(createJsonRequest(BASE_URL), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "このグループの支出を閲覧する権限がありません",
    });
  });

  describe("フィルタ", () => {
    beforeEach(() => {
      setupAuthenticatedMember();
      mockExpenseFindMany.mockResolvedValue([]);
    });

    it("クエリパラメータがなければ groupId のみで絞り込む", async () => {
      await GET(createJsonRequest(BASE_URL), params);

      expect(mockExpenseFindMany).toHaveBeenCalledOnce();
      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where).toEqual({ groupId: GROUP_ID });
    });

    it("category で絞り込める", async () => {
      await GET(createJsonRequest(`${BASE_URL}?category=食費`), params);

      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where).toEqual({ groupId: GROUP_ID, category: "食費" });
    });

    it("不正な category は無視される", async () => {
      await GET(createJsonRequest(`${BASE_URL}?category=不明`), params);

      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where).toEqual({ groupId: GROUP_ID });
    });

    it("memberId で絞り込める", async () => {
      await GET(createJsonRequest(`${BASE_URL}?memberId=${USER_B}`), params);

      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where).toEqual({ groupId: GROUP_ID, memberId: USER_B });
    });

    it("from/to で期間を絞り込める(to は翌日0時未満として扱う)", async () => {
      await GET(
        createJsonRequest(`${BASE_URL}?from=2026-01-01&to=2026-01-31`),
        params
      );

      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where.groupId).toBe(GROUP_ID);
      expect(where.date.gte.toISOString()).toBe(
        new Date("2026-01-01").toISOString()
      );
      expect(where.date.lt.toISOString()).toBe(
        new Date("2026-02-01").toISOString()
      );
    });

    it("不正な日付は無視される", async () => {
      await GET(createJsonRequest(`${BASE_URL}?from=not-a-date`), params);

      const { where } = mockExpenseFindMany.mock.calls[0][0];
      expect(where).toEqual({ groupId: GROUP_ID });
    });
  });
});

describe("POST /api/groups/[groupId]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedMember();
  });

  it("未認証は 401 を返す", async () => {
    mockRequireAuthUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: { category: "食費", amount: 1000 },
      }),
      params
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "認証が必要です" });
  });

  it("非メンバーは 403 を返す", async () => {
    mockAssertGroupMember.mockRejectedValue(new Error("FORBIDDEN"));

    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: { category: "食費", amount: 1000 },
      }),
      params
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "このグループに支出を登録する権限がありません",
    });
  });

  it("カテゴリまたは金額がないと 400 を返す", async () => {
    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: { category: "食費" },
      }),
      params
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "カテゴリと金額は必須です" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("配分比率の合計が 100% でないと 400 を返す", async () => {
    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: {
          category: "食費",
          amount: 1000,
          shares: [
            { userId: USER_A, percent: 50 },
            { userId: USER_B, percent: 30 },
          ],
        },
      }),
      params
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "配分比率の合計は100%にしてください",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("グループ外メンバーへの配分は 400 を返す", async () => {
    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: {
          category: "食費",
          amount: 1000,
          shares: [
            { userId: USER_A, percent: 50 },
            { userId: "outsider", percent: 50 },
          ],
        },
      }),
      params
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "配分比率に不正なメンバーまたは値が含まれています",
    });
  });

  it("負の配分比率は 400 を返す", async () => {
    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: {
          category: "食費",
          amount: 1000,
          shares: [
            { userId: USER_A, percent: 110 },
            { userId: USER_B, percent: -10 },
          ],
        },
      }),
      params
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "配分比率に不正なメンバーまたは値が含まれています",
    });
  });

  it("支払いメンバーがグループにいないと 400 を返す", async () => {
    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: {
          category: "食費",
          amount: 1000,
          memberId: "outsider",
        },
      }),
      params
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "支払いメンバーがグループに存在しません",
    });
  });

  it("有効な入力は 201 で支出を返す", async () => {
    const createdAt = new Date("2026-01-01T12:00:00.000Z");
    mockCreate.mockResolvedValue({
      id: "exp-1",
      category: "食費",
      amount: 2000,
      memo: "ランチ",
      date: createdAt,
      member: { id: USER_A, name: "A", avatarUrl: null },
      shares: [
        { user: { id: USER_A, name: "A" }, percent: 50 },
        { user: { id: USER_B, name: "B" }, percent: 50 },
      ],
    });

    const res = await POST(
      createJsonRequest(BASE_URL, {
        method: "POST",
        body: {
          category: "食費",
          amount: 2000,
          memo: "ランチ",
          shares: [
            { userId: USER_A, percent: 50 },
            { userId: USER_B, percent: 50 },
          ],
        },
      }),
      params
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      id: "exp-1",
      category: "食費",
      amount: 2000,
      memberId: USER_A,
      memberName: "A",
      memo: "ランチ",
      date: createdAt.toISOString(),
      shares: [
        { userId: USER_A, userName: "A", percent: 50 },
        { userId: USER_B, userName: "B", percent: 50 },
      ],
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

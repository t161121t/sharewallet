import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GroupRole } from "@/generated/prisma/client";

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: {
      findUnique: mockFindUnique,
    },
  },
}));

import {
  assertGroupMember,
  assertGroupRole,
  createToken,
  getAuthUserId,
  requireAuthUserId,
  verifyToken,
} from "@/lib/auth";

function bearerRequest(token: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("auth JWT", () => {
  it("createToken で生成したトークンを verifyToken で検証できる", async () => {
    const token = await createToken("user-123");
    await expect(verifyToken(token)).resolves.toBe("user-123");
  });

  it("不正なトークンは null を返す", async () => {
    await expect(verifyToken("invalid.token.value")).resolves.toBeNull();
  });

  it("Authorization ヘッダーがないと getAuthUserId は null", async () => {
    const req = new NextRequest("http://localhost/api/test");
    await expect(getAuthUserId(req)).resolves.toBeNull();
  });

  it("Bearer 以外の形式では getAuthUserId は null", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Token abc" },
    });
    await expect(getAuthUserId(req)).resolves.toBeNull();
  });

  it("有効な Bearer トークンから userId を取得できる", async () => {
    const token = await createToken("user-abc");
    await expect(getAuthUserId(bearerRequest(token))).resolves.toBe("user-abc");
  });

  it("未認証の requireAuthUserId は UNAUTHORIZED を投げる", async () => {
    const req = new NextRequest("http://localhost/api/test");
    await expect(requireAuthUserId(req)).rejects.toThrow("UNAUTHORIZED");
  });
});

describe("assertGroupMember", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("グループメンバーならメンバー情報を返す", async () => {
    const member = { id: "gm-1", userId: "user-1", groupId: "group-1", role: GroupRole.MEMBER };
    mockFindUnique.mockResolvedValue(member);

    await expect(assertGroupMember("group-1", "user-1")).resolves.toEqual(member);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId_groupId: { userId: "user-1", groupId: "group-1" } },
    });
  });

  it("非メンバーは FORBIDDEN を投げる", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(assertGroupMember("group-1", "outsider")).rejects.toThrow("FORBIDDEN");
  });
});

describe("assertGroupRole", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it("許可されたロールならメンバー情報を返す", async () => {
    const member = { id: "gm-1", userId: "user-1", groupId: "group-1", role: GroupRole.OWNER };
    mockFindUnique.mockResolvedValue(member);

    await expect(
      assertGroupRole("group-1", "user-1", [GroupRole.OWNER, GroupRole.ADMIN])
    ).resolves.toEqual(member);
  });

  it("ロール不足は FORBIDDEN を投げる", async () => {
    mockFindUnique.mockResolvedValue({
      id: "gm-1",
      userId: "user-1",
      groupId: "group-1",
      role: GroupRole.MEMBER,
    });

    await expect(
      assertGroupRole("group-1", "user-1", [GroupRole.OWNER])
    ).rejects.toThrow("FORBIDDEN");
  });
});

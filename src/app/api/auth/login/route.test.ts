import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest } from "@/test/helpers";

const {
  mockFindUnique,
  mockCompare,
  mockConsumeRateLimit,
  mockCreateToken,
  mockIssueRefreshToken,
  mockSetAuthCookies,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCompare: vi.fn(),
  mockConsumeRateLimit: vi.fn(),
  mockCreateToken: vi.fn(),
  mockIssueRefreshToken: vi.fn(),
  mockSetAuthCookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mockCompare },
}));

vi.mock("@/lib/auth", () => ({
  createToken: mockCreateToken,
  issueRefreshToken: mockIssueRefreshToken,
  setAuthCookies: mockSetAuthCookies,
}));

vi.mock("@/lib/rateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rateLimit")>("@/lib/rateLimit");
  return {
    ...actual,
    consumeRateLimit: mockConsumeRateLimit,
    getClientIp: () => "127.0.0.1",
  };
});

import { POST } from "./route";

const URL = "http://localhost/api/auth/login";
const USER = {
  id: "user-1",
  name: "太郎",
  email: "taro@example.com",
  color: "#c9a227",
  avatarUrl: null,
  passwordHash: "stored-hash",
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeRateLimit.mockResolvedValue({ allowed: true });
    mockIssueRefreshToken.mockResolvedValue("refresh-token");
  });

  it("email/passwordが無いと400を返す", async () => {
    const res = await POST(createJsonRequest(URL, { method: "POST", body: {} }));

    expect(res.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("IP単位の試行回数が上限を超えたら429を返す", async () => {
    mockConsumeRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "taro@example.com", password: "password123" },
      })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("ユーザーが存在しない、またはパスワードが誤っている場合401を返す", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "unknown@example.com", password: "password123" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("空白のない誤ったパスワードはbcryptで一度だけ照合する", async () => {
    mockFindUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValue(false);

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "taro@example.com", password: "wrong-password" },
      })
    );

    expect(res.status).toBe(401);
    expect(mockCompare).toHaveBeenCalledTimes(1);
  });

  it("末尾に空白のあるパスワードでも、正規化(trim)された値で照合する", async () => {
    mockFindUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValue(true);
    mockCreateToken.mockResolvedValue("token");

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "taro@example.com", password: "password123 " },
      })
    );

    expect(res.status).toBe(200);
    // trim前の"password123 "ではなく、trim後の"password123"で照合すること
    // (register/password-changeがtrim後の値をハッシュ化・保存しているため、
    // ここで正規化しないと本人がログインできなくなる)
    expect(mockCompare).toHaveBeenCalledWith("password123", "stored-hash");
    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "token", "refresh-token");
  });

  it("正規化後の照合が失敗しても、生の値での照合(後方互換)が成功すればログインできる", async () => {
    // このPRより前に登録された既存アカウントは、trimしていない生の値で
    // ハッシュ化されている可能性がある。正規化後の比較(1回目)が失敗しても、
    // 生の値での比較(2回目)が成功すればログインできることを確認する。
    mockFindUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValueOnce(false); // 1回目: normalizePassword後の値
    mockCompare.mockResolvedValueOnce(true); // 2回目: 生の値(後方互換フォールバック)
    mockCreateToken.mockResolvedValue("token");

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "taro@example.com", password: "password123 " },
      })
    );

    expect(res.status).toBe(200);
    expect(mockCompare).toHaveBeenNthCalledWith(1, "password123", "stored-hash");
    expect(mockCompare).toHaveBeenNthCalledWith(2, "password123 ", "stored-hash");
  });

  it("正しい入力ならログインできる", async () => {
    mockFindUnique.mockResolvedValue(USER);
    mockCompare.mockResolvedValue(true);
    mockCreateToken.mockResolvedValue("token");

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { email: "taro@example.com", password: "password123" },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: {
        id: USER.id,
        name: USER.name,
        email: USER.email,
        color: USER.color,
        avatarUrl: undefined,
      },
    });
  });
});

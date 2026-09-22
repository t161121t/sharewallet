import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonRequest } from "@/test/helpers";

const { mockFindUnique, mockCreate, mockHash, mockConsumeRateLimit } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockHash: vi.fn(),
  mockConsumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique, create: mockCreate },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash },
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

const URL = "http://localhost/api/auth/register";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeRateLimit.mockResolvedValue({ allowed: true });
    mockFindUnique.mockResolvedValue(null);
  });

  it("name/email/passwordが無いと400を返す", async () => {
    const res = await POST(createJsonRequest(URL, { method: "POST", body: {} }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("パスワードが8文字未満だと400を返す", async () => {
    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { name: "太郎", email: "taro@example.com", password: "short" },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "パスワードは8文字以上で入力してください",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("パスワードが空白のみ(trim後8文字未満)だと400を返す", async () => {
    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: { name: "太郎", email: "taro@example.com", password: "        " },
      })
    );

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("正しい入力なら登録し、trim後のパスワードをハッシュ化する", async () => {
    mockHash.mockResolvedValue("hashed");
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "太郎",
      email: "taro@example.com",
      color: "#c9a227",
    });

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: {
          name: "太郎",
          email: "taro@example.com",
          password: "password123 ",
        },
      })
    );

    expect(res.status).toBe(200);
    // trim前の"password123 "ではなく、trim後の"password123"がhashされること
    expect(mockHash).toHaveBeenCalledWith("password123", 10);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "太郎",
        email: "taro@example.com",
        passwordHash: "hashed",
      },
    });
  });

  it("メールアドレスが既に登録済みなら409を返す", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" });

    const res = await POST(
      createJsonRequest(URL, {
        method: "POST",
        body: {
          name: "太郎",
          email: "taro@example.com",
          password: "password123",
        },
      })
    );

    expect(res.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

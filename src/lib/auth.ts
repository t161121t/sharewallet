import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GroupRole } from "@/generated/prisma/client";
import {
  AUTH_COOKIE_NAME,
  AUTH_PRESENCE_COOKIE_NAME,
  createToken,
  verifyToken,
  setAuthCookies,
  clearAuthCookies,
  getAuthUserId,
} from "@/lib/auth-edge";

/**
 * JWT/Cookie関連の関数は `@/lib/auth-edge`(Prismaに依存しない、Edgeランタイムでも
 * 使えるモジュール)で定義されており、ここではそのまま re-export している。
 * `src/middleware.ts` はこのファイルではなく `@/lib/auth-edge` を直接importすること
 * (このファイルはPrismaに依存する関数を含むため、Edgeランタイムでは読み込めない)。
 */
export {
  AUTH_COOKIE_NAME,
  AUTH_PRESENCE_COOKIE_NAME,
  createToken,
  verifyToken,
  setAuthCookies,
  clearAuthCookies,
  getAuthUserId,
};

export async function requireAuthUserId(req: NextRequest): Promise<string> {
  const userId = await getAuthUserId(req);
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export async function getGroupMember(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: {
      userId_groupId: { userId, groupId },
    },
  });
}

export async function assertGroupMember(groupId: string, userId: string) {
  const member = await getGroupMember(groupId, userId);
  if (!member) {
    throw new Error("FORBIDDEN");
  }
  return member;
}

export async function assertGroupRole(
  groupId: string,
  userId: string,
  allowedRoles: GroupRole[]
) {
  const member = await assertGroupMember(groupId, userId);
  if (!allowedRoles.includes(member.role)) {
    throw new Error("FORBIDDEN");
  }
  return member;
}

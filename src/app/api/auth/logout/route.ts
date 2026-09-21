import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";

/** POST /api/auth/logout - 認証 Cookie を破棄する */
export async function POST() {
  const res = NextResponse.json<{ ok: boolean }>({ ok: true });
  clearAuthCookies(res);
  return res;
}

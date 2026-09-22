import bcrypt from "bcryptjs";
import { normalizePassword } from "@/lib/validation";

const BCRYPT_ROUNDS = 10;

/** 正規化(trim)した値をbcryptでハッシュ化する。login/register/password-changeで共通利用。 */
export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(normalizePassword(rawPassword), BCRYPT_ROUNDS);
}

/**
 * まず正規化(trim)した値でハッシュと照合する。normalizePassword導入(PR #50)
 * より前に登録された既存アカウントは、trimしていない生の値でハッシュ化されて
 * いる可能性があるため、正規化後の比較で一致しなければ後方互換として生の値でも
 * 一度だけ照合を試みる。(パスワードに前後の空白がない大多数のケースでは、
 * trim後の値と生の値が同一なので1回目の比較だけで完結し、2回目は実行されない)
 */
export async function verifyPassword(
  rawPassword: unknown,
  passwordHash: string
): Promise<boolean> {
  if (typeof rawPassword !== "string") return false;
  if (await bcrypt.compare(normalizePassword(rawPassword), passwordHash)) return true;
  return bcrypt.compare(rawPassword, passwordHash);
}

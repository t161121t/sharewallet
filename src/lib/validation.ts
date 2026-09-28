/** 新しいパスワードの最小文字数。クライアント(profile/page.tsx, register/page.tsx)とサーバーで共有する。 */
export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt が安全に扱える正規化後パスワードの最大 UTF-8 バイト数。 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * パスワード文字列を正規化する(前後の空白を除去)。
 *
 * bcryptで扱う全ての箇所(login/register/password-change)で必ずこの関数を
 * 通した値を使うこと。ハッシュ化・照合のどちらか一方だけがtrimしていると、
 * 「登録/変更時の検証は通るのに、次回ログイン時には一致しない(自分を
 * ロックアウトする)」という不整合が起きる。
 */
export function normalizePassword(raw: string): string {
  return raw.trim();
}

/** 正規化後の長さがMIN_PASSWORD_LENGTH以上か */
export function isPasswordLongEnough(raw: string): boolean {
  return normalizePassword(raw).length >= MIN_PASSWORD_LENGTH;
}

/** 正規化後のパスワードが bcrypt の72バイト上限に収まるか。 */
export function isPasswordWithinBcryptLimit(raw: string): boolean {
  return new TextEncoder().encode(normalizePassword(raw)).length <= MAX_PASSWORD_BYTES;
}

/**
 * "YYYY-MM-DD" 形式の支出日付文字列を検証し、UTC正午のDateへ変換する。
 * 不正な形式・実在しない日付(例: 2月30日)の場合は null を返す。
 *
 * 支出の作成(POST /api/groups/:groupId/expenses)と編集
 * (PUT /api/groups/:groupId/expenses/:expenseId)の両方で同じ形式・同じ
 * 実在チェックを行う必要があるため、ここに1つだけ実装を置く。片方だけ
 * チェックを緩めたり厳しくしたりすると、作成時は通るのに編集時は弾かれる
 * (またはその逆)という不整合が起きる。
 */
export function parseExpenseDate(raw: string): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return null;
  return parsed;
}

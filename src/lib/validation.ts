/** 新しいパスワードの最小文字数。クライアント(profile/page.tsx, register/page.tsx)とサーバーで共有する。 */
export const MIN_PASSWORD_LENGTH = 8;

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

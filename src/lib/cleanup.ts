const CLEANUP_PROBABILITY = 0.01;

/**
 * 確率的なTTLクリーンアップの共通ヘルパー。毎回チェックすると無駄なので、
 * 低確率(1%)でだけ実際の削除処理を実行する。掃除に失敗しても呼び出し元の
 * 主処理は継続させたいため、エラーは握りつぶす。
 *
 * rate_limit_entries(レート制限)・refresh_tokens(リフレッシュトークン)の
 * 期限切れ行のクリーンアップで共通利用する。
 */
export async function probabilisticCleanup(deleteExpired: () => Promise<unknown>): Promise<void> {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  await deleteExpired().catch(() => undefined);
}

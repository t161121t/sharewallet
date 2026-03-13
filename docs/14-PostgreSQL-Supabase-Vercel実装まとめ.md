# 14. SQLite→Supabase(PostgreSQL)→Vercel 実装まとめ（初心者向け）

## これは何のドキュメント？

このファイルは、今回行った以下の作業を、初心者でも追えるようにまとめたものです。

- Prisma のDB接続を `SQLite` から `PostgreSQL` に変更
- Supabase の無料PostgreSQLに接続
- Vercel に本番デプロイ

---

## まず結論（今回できたこと）

- ローカル実装は `SQLite` 依存から `PostgreSQL` 依存に切り替え完了
- Supabase のDBに対して migration 適用 + seed 実行完了
- Vercel 本番デプロイ完了
- 本番URLで疎通確認完了
  - `/` が表示される
  - `/api/health` が `200`
  - `/api/auth/login` が成功

---

## なぜSQLiteから移行したの？

SQLite はローカル開発には便利ですが、ファイルベースDBなので本番運用に制約があります。  
今回は「無料で本番運用しやすい構成」にするため、`Supabase(PostgreSQL)` を使う形にしました。

---

## 変更したファイル（重要なもの）

- `prisma/schema.prisma`
  - `datasource db { provider = "postgresql" }` に変更
- `src/lib/prisma.ts`
  - `@prisma/adapter-pg` + `pg` を使った接続に変更
- `prisma/seed.ts`
  - PostgreSQL接続で seed できるように変更
- `prisma.config.ts`
  - migration 実行時は `DIRECT_URL` を優先するよう変更
- `README.md`
  - Supabase + Vercel 前提の手順へ更新
- `.env.example`
  - 必要な環境変数テンプレートを追加
- `package.json`
  - 追加: `@prisma/adapter-pg`, `pg`
  - 削除: `@prisma/adapter-better-sqlite3`
  - 更新: `next`, `eslint-config-next`（セキュリティブロック対策）

---

## 実装の流れ（実際にやった順）

### 1) PrismaをPostgreSQL対応に変更

- Prismaのproviderを `sqlite` -> `postgresql` へ変更
- アプリ内のPrismaクライアントを `PrismaPg` で初期化する実装へ変更

### 2) Supabase接続情報を設定

`.env` に以下を設定。

- `DATABASE_URL`: Transaction Pooler（アプリ実行向け）
- `DIRECT_URL`: Direct connection（migration向け）
- `JWT_SECRET`: 本番で使う秘密鍵

### 3) migration をSupabaseへ反映

実行コマンド:

```bash
npx prisma migrate deploy
npx prisma db seed
```

`seed` 完了まで確認できています。

### 4) Vercelの本番設定

- `vercel login` 実行
- プロジェクトをリンク
- 本番環境変数を設定
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `JWT_SECRET`

### 5) デプロイ時エラーの解消

初回デプロイで「Next.jsの脆弱性バージョン」エラーが出たため、  
`next` と `eslint-config-next` を安全なpatch版へ更新して再デプロイ。

その後、デプロイ成功。

---

## 本番確認結果

確認済み:

- `GET /` -> `200 OK`
- `GET /api/health` -> `200 OK`
- `POST /api/auth/login`（seedユーザー） -> token取得成功

---

## 初心者がハマりやすいポイント

### 1) `DATABASE_URL` と `DIRECT_URL` の違い

- `DATABASE_URL`: アプリが普段使う接続（Pooler）
- `DIRECT_URL`: Prisma migration など管理系で使う接続（Direct）

この2つを分けないと、migrationで失敗しやすいです。

### 2) Vercel + Supabase で Direct だけ使うと失敗しやすい

Vercel環境では、`DATABASE_URL` に Pooler を使うのが基本です。

### 3) Secretの扱い

チャットにパスワードを書いた場合は、作業後に必ず再発行してください。

---

## セキュリティ対応（必須）

以下は必ず実施してください。

1. Supabase の DB パスワードを再発行
2. Vercel の環境変数を新しい値に更新
   - `DATABASE_URL`
   - `DIRECT_URL`
3. 必要ならローカル `.env` も更新

---

## 最低限の運用コマンド

```bash
# Prismaクライアント再生成
npx prisma generate

# migration適用（本番/ステージング）
npx prisma migrate deploy

# seed投入
npx prisma db seed

# ローカル起動
npm run dev
```

---

## 次にやると良いこと

- `README.md` の「本番運用ルール」をもう少し詳しくする
- GitHub Actions で `lint` / `build` 自動実行
- 将来的に migration 戦略（誰がいつ適用するか）をチームで固定する


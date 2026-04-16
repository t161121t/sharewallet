# ShareWallet

複数人で支出を記録・共有するための **Web アプリ** です。ログイン後に所属グループを選び、支出の登録・履歴の閲覧・プロフィール更新などができます。  
フロントは **Next.js（App Router）**、API は **Route Handler**、永続化は **Prisma + PostgreSQL（Supabase）** で構成しています。

**リポジトリ**: https://github.com/t161121t/sharewallet 

---

## レビュー用サマリ

| 項目 | 内容 |
|------|------|
| 目的 | グループ単位の支出を一元管理し、履歴として追えるようにする |
| 認証 | メール／パスワード登録、JWT（`jose`）で API 保護 |
| API | `src/app/api/*`（Next.js Route Handler） |
| DB | Prisma ORM、PostgreSQL（本番は Supabase） |
| デプロイ | Vercel（環境変数で DB 接続・JWT 秘密鍵を注入） |

### アーキテクチャ（ざっくり）

```
ブラウザ → Next.js ページ（React） → apiClient → Route Handler → Prisma → PostgreSQL
```

### 主な画面・機能

- スプラッシュ・ホーム、ログイン／新規登録  
- ダッシュボード（グループ選択）、支出入力・履歴、プロフィール  

### 技術スタック

- **言語**: TypeScript  
- **フレームワーク**: Next.js 15（App Router）、React 19  
- **UI**: Tailwind CSS 4、Framer Motion、Recharts  
- **DB / ORM**: PostgreSQL、Prisma v7、`@prisma/adapter-pg` + `pg`  
- **認証**: bcryptjs（パスワードハッシュ）、jose（JWT）  

詳細な実装状況・未実装一覧は [`docs/10-実装状況サマリー.md`](docs/10-実装状況サマリー.md) を参照してください。

---

## 前提環境

- Node.js 20 系（推奨: 20 LTS）  
- npm 10 系以上  
- OS: macOS / Linux / Windows（WSL 可）  

---

## セットアップ（初回）

```bash
git clone https://github.com/t161121t/sharewallet_frontend.git
cd sharewallet_frontend
npm install
```

### 1. Supabase で DB を用意

1. [Supabase](https://supabase.com) でプロジェクト作成（Free plan 可）  
2. **Project Settings → Database** で接続文字列を取得  
3. アプリ実行用は **Transaction pooler**、マイグレーション用は **Direct connection** を使う  

### 2. 環境変数

`.env.example` をコピーして `.env` を作成し、値を埋めます。

```bash
cp .env.example .env
```

| 変数 | 役割 |
|------|------|
| `DATABASE_URL` | アプリ実行用（Pooler 推奨。`?pgbouncer=true&connection_limit=1` を付与） |
| `DIRECT_URL` | Prisma `migrate` 用（Direct 接続） |
| `JWT_SECRET` | JWT 署名用の長いランダム文字列（本番は必ず独自生成） |

### 3. DB マイグレーションと seed

リポジトリに `prisma/migrations` が含まれるため、**新規にスキーマを作るのではなく既存 migration を適用**します。

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed   # 任意：テストユーザー・支出データ投入
```

seed 利用時のログイン例（開発用）: メール `tanaka@example.com` / パスワード `password123`（[`prisma/seed.ts`](prisma/seed.ts) と同内容）

### 4. 開発サーバー

```bash
npm run dev
```

- ブラウザ: http://localhost:3000  

---

## よく使うコマンド

```bash
npm run dev      # 開発サーバー（Turbopack）
npm run lint     # ESLint
npm run build    # 本番ビルド
```

---

## ディレクトリの目安（読む順）

| パス | 内容 |
|------|------|
| [`src/app`](src/app) | ページと Route Handler（`api/`） |
| [`src/lib/apiClient.ts`](src/lib/apiClient.ts) | フロントから API 呼び出し・トークン管理 |
| [`src/lib/prisma.ts`](src/lib/prisma.ts) | Prisma クライアント（サーバ側） |
| [`prisma/schema.prisma`](prisma/schema.prisma) | DB スキーマ |
| [`docs/`](docs) | 実装手順・API 仕様・移行メモなど |

---

## 本番デプロイ（Vercel）

1. GitHub リポジトリを Vercel に接続  
2. **Environment Variables** に `DATABASE_URL` / `DIRECT_URL` / `JWT_SECRET` を設定（値は Supabase・本番用に合わせる）  
3. `main` をデプロイ  
4. ログイン・グループ取得・支出登録が動くか確認  

（デプロイ先 URL はプロジェクト設定により異なります。）

---

## トラブルシュート

### Prisma 接続エラー（P1001 / P1002）

- `DATABASE_URL` のホスト・パスワード・リージョンが正しいか  
- Pooler 利用時はクエリに `pgbouncer=true&connection_limit=1` があるか  

### Migration が失敗する

- `DIRECT_URL` を設定してから `npx prisma migrate deploy` を再実行  
- **開発 DB のみ** 初期化する場合: `npx prisma migrate reset`（データ消失に注意）  

### `Next.js inferred your workspace root` 警告

親ディレクトリに別の lockfile があると出ることがあります。通常は動作に支障ありません。

---

## ライセンス・注意

- 本 README の接続例はプレースホルダです。**本番の秘密情報はリポジトリにコミットしないでください。**  
- `.env` は `.gitignore` 対象です。`.env.example` のみテンプレートとして共有します。

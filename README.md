# ShareWallet Frontend

ShareWallet のフロントエンド（Next.js + Prisma + Supabase PostgreSQL）です。  
ローカル開発とVercel本番デプロイまでの手順をまとめています。

## 前提環境

- Node.js: 20系（推奨: 20 LTS）
- npm: 10系以上
- OS: macOS / Linux / Windows（WSL可）

## セットアップ手順（初回）

```bash
git clone <このリポジトリURL>
cd sharewallet_frontend
npm install
```

## Supabase 準備

1. Supabaseで新規プロジェクトを作成（Free plan）。
2. `Project Settings > Database` から接続URLを取得。
3. `Transaction pooler` の接続文字列を `DATABASE_URL` に設定。

## 環境変数

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` の値を埋めてください。

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
JWT_SECRET="your-long-random-secret"
```

## DB 準備（Prisma）

初回は以下を実行してください。

```bash
npx prisma migrate dev --name init_postgres
npx prisma generate
```

テストデータを入れたい場合:

```bash
npx prisma db seed
```

seed のログイン用パスワード: `password123`

## 開発サーバー起動

```bash
npm run dev
```

ブラウザで以下を開きます:

- http://localhost:3000

## Vercel デプロイ

1. GitHubリポジトリをVercelにImport
2. Environment Variablesに以下を設定
   - `DATABASE_URL`（Supabase pooler URL）
   - `DIRECT_URL`（Supabase direct URL）
   - `JWT_SECRET`
3. `main` ブランチをデプロイ
4. デプロイ後、ログイン・グループ取得・支出登録を確認

## よく使うコマンド

```bash
npm run dev      # 開発サーバー
npm run lint     # ESLint
npm run build    # 本番ビルド
```

## トラブルシュート

### 1) Prisma の接続エラー（P1001 / P1002）

- `DATABASE_URL` の project-ref / password が正しいか確認
- Supabase DB が停止していないか確認
- pooler URL を使っている場合は `?pgbouncer=true&connection_limit=1` を付与

### 2) Migration が失敗する

- `DIRECT_URL` を設定して再実行
- `npx prisma migrate reset`（開発環境のみ）でやり直し

### 3) `Next.js inferred your workspace root` 警告

複数 lockfile がある環境で出る警告です。  
基本的に開発動作には影響しません。

## 引き継ぎメモ

- DB は Supabase PostgreSQL です
- API は `src/app/api` 配下の Route Handler です
- 主要型は `src/types/index.ts`
- API クライアントは `src/lib/apiClient.ts`

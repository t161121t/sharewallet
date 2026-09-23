# ShareWallet の作業ルール

## 最初に読むもの

- 作業を始める前に、ルートの `CLAUDE.md` を必ず読み、そこにある PR・学習用ドキュメントのルールを Codex にも適用する。共通ルールの原本は `CLAUDE.md` とし、ここに複製しない。
- 環境構築は `README.md`、利用可能なコマンドは `package.json`、CI の検証内容は `.github/workflows/ci.yml` を確認する。
- 説明、作業報告、PR 本文、学習用ドキュメントは日本語で書く。

## プロジェクト構成

- Next.js App Router / React / TypeScript。ページと API Route Handler は `src/app/`。
- 共通 UI は `src/components/`、認証・API クライアント・精算ロジックなどは `src/lib/`。
- Prisma + PostgreSQL。スキーマは `prisma/schema.prisma`、履歴は `prisma/migrations/`。
- 既存のコンポーネント、API の認証・エラー処理、テストの書き方に合わせる。生成物 `src/generated/prisma/` は直接編集しない。

## 作業手順

- 最初に `git status --short` を確認し、既存の未コミット変更や未追跡ファイルを保持する。今回の変更だけを明示的にステージする。
- 検索・検証では `.claude/worktrees/` にある別作業のコピーを対象にしない。
- npm と `package-lock.json` を使う。依存関係を変更した場合はロックファイルも更新する。
- `.env`、`.env.local`、トークンなどの秘密情報は出力・コミットしない。設定例は `.env.example` を参照する。
- DB の migration・seed は接続先と依頼範囲を確認して実施する。環境設定だけの作業で自動実行しない。

## 検証

コードや検証設定の変更時は、CI と同じ次のコマンドを実行する。

```bash
npm run typecheck
npm test
npm run lint
```

- ビルドへの影響がある変更は `npm run build` も実行する。
- 文書だけの変更はリンク先と `git diff --check` を確認する。
- 失敗した場合は今回の変更と既存の問題を切り分け、実行結果と未検証の範囲を報告する。

## PR と学習記録

- PR 作成前に `.github/pull_request_template.md` を読み、その見出しに沿って本文を書く。実行していない確認にチェックを付けない。
- `CLAUDE.md` の対象条件に該当する実装では、`docs/` の最大番号 + 1 で日本語の学習記録を作る。構成も `CLAUDE.md` に従う。
- 関連 issue / PR がある場合は実際の URL を記載し、未作成の番号や検証結果を作らない。

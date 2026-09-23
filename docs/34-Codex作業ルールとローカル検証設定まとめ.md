# 34. Codex 作業ルールとローカル検証設定まとめ

## これは何のドキュメント？

`CLAUDE.md` に沿って Codex の作業ルールとローカルの検証設定を整えた記録です。今回の依頼に対応する issue / PR は未作成です。[32. CI 型チェック追加まとめ](32-CI型チェック追加まとめ.md) の検証方針をローカル作業でも使います。

## まず結論（今回できたこと）

- `AGENTS.md` から `CLAUDE.md` を必ず読むように指定し、PR と学習記録のルールを共有しました。
- 日本語での報告、既存変更の保持、プロジェクト構成、検証コマンドを明文化しました。
- Claude Code のローカル設定・作業コピーを Git の追加対象から除外しました。
- 作業コピーを TypeScript と ESLint の検証対象から除外しました。
- README の clone 先を実際のリポジトリに修正し、型チェックとテストのコマンドを追記しました。

## 背景 — なぜこの変更が必要だったか

既存の `CLAUDE.md` には PR テンプレートと学習用ドキュメントのルールがありましたが、Codex 向けの入口はありませんでした。Codex が作業開始時に読む `AGENTS.md` に参照を置き、ルールの読み忘れを防ぎます。[OpenAI 公式ドキュメント](https://learn.chatgpt.com/docs/agent-configuration/agents-md)に沿った構成です。

また、ローカルの `.claude/worktrees/` には複数の作業コピーが存在しました。Git の除外設定だけでは TypeScript や ESLint の対象を制御できないため、それぞれに除外設定を追加しました。

## 選択肢の比較

| 方針 | メリット | デメリット | 判断 |
| --- | --- | --- | --- |
| `CLAUDE.md` を `AGENTS.md` に丸ごと複製 | 1 ファイルで全文を読める | 更新時に内容がずれやすい | 不採用 |
| `AGENTS.md` から原本を読むよう指定 | 共通ルールを 1 か所で管理できる | 作業開始時に原本を読む必要がある | 採用 |

## 目的

主目的は、Codex が既存の開発方針に沿い、現在のプロジェクトを対象に検証できるようにすることです。

| あえてやらなかったこと | 理由 |
| --- | --- |
| グローバルのモデル・権限設定の変更 | このプロジェクトのルールはリポジトリ内で共有できるため |
| DB の migration・seed、デプロイ | 作業ルールの設定に必要ないため |
| 既存の未追跡ファイルや worktree の削除 | 別作業のデータを保持するため |

## 何を実装したか

### Codex の入口

`AGENTS.md` は、最初に `CLAUDE.md` を読むことを指定しています。さらに、`package.json` と CI にある実際のコマンドを検証手順として記載しました。モデル名や個人の認証情報は保存していません。

### Git・検証対象の調整

`.gitignore` に次を追加しました。共有する Claude の指示や設定まで一括で除外しないよう、対象を限定しています。

```gitignore
/.claude/settings.local.json
/.claude/worktrees/
```

`tsconfig.json` の設定は次のとおりです。

```json
"exclude": ["node_modules", ".claude/worktrees"]
```

`eslint.config.mjs` の既存の `ignores` に追加した項目は次のとおりです。

```js
".claude/worktrees/**",
```

Vitest は既に `src/**/*.test.ts` に対象を限定しているため、変更していません。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `AGENTS.md` | Codex の作業ルールと共通ルールへの参照 |
| `.gitignore` | ローカル設定と worktree の除外 |
| `tsconfig.json` | worktree を型チェック対象から除外 |
| `eslint.config.mjs` | worktree を Lint 対象から除外 |
| `README.md` | clone 先の修正、検証コマンド・作業ルールへのリンク |
| `docs/34-Codex作業ルールとローカル検証設定まとめ.md` | 本記録 |

## 動作確認

| コマンド | 結果 |
| --- | --- |
| `npm run typecheck` | 成功 |
| `npm test` | 8 ファイル・63 テスト成功 |
| `npm run lint` | エラー 0、既存の警告 1 |
| `git diff --check` | 成功 |
| `git check-ignore .claude/settings.local.json .claude/worktrees/example/src/app/page.tsx` | 両方が除外対象であることを確認 |

Lint の警告は `src/app/expense/page.tsx:356` の `<img>` に関するもので、今回変更したファイルではありません。本番ビルド、DB 接続、デプロイは未検証です。別の Codex セッションを起動しての自動読込確認は行っていません。

## 今後の拡張候補

| 優先度 | 候補 |
| --- | --- |
| 低 | 作業領域ごとに追加ルールが必要になったら、子ディレクトリに `AGENTS.md` を追加する |
| 低 | 既存の画像 Lint 警告を別の変更として解消する |

## よくある質問

### 共通ルールを変えるときはどこを編集する？

PR と学習記録の詳細は `CLAUDE.md` を編集します。Codex 固有の読み方や作業手順は `AGENTS.md` を編集します。

### `.gitignore` に追加すると worktree は消える？

消えません。Git の通常の追加対象から外れるだけで、既存の作業ファイルはそのまま残ります。

### なぜ TypeScript と ESLint にも設定した？

Git に追加するファイルと、検証ツールが読むファイルは別々に決まるためです。どちらも現在の作業コピーだけを検証するよう指定しています。

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md)
- [AGENTS.md](../AGENTS.md)
- [PR テンプレート](../.github/pull_request_template.md)
- [README](../README.md)
- [CI 型チェック追加まとめ](32-CI型チェック追加まとめ.md)
- [OpenAI 公式: AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

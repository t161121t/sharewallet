# 23. API バリデーション・認証テストと CI 実装まとめ

## これは何のドキュメント？

[22. 精算ロジック ユニットテスト実装まとめ](./22-精算ロジックテスト実装まとめ.md) の続きとして、次を追加した作業の記録です。

- **認証ヘルパー**（JWT・グループ権限）のユニットテスト
- **支出 API**（`POST/GET /api/groups/:groupId/expenses`）のバリデーション・認証テスト
- **GitHub Actions CI**（テスト + リントの自動実行）

---

## まず結論（今回できたこと）

| 項目 | 内容 |
| --- | --- |
| テスト総数 | **28 件**（精算 8 + 認証 10 + 支出 API 10） |
| 実行時間 | 約 200ms（DB 不要） |
| CI | `push` / `pull_request` で `npm test` + `npm run lint` を自動実行 |
| プロダクションコード | **変更なし**（テスト・CI 設定のみ追加） |

```bash
npm test   # 全 28 件を一括実行
```

---

## 背景 — なぜこの 3 つを追加したか

精算ロジックのテスト（doc 22）で「テスト基盤の第一歩」は踏み出しましたが、sharewallet にはまだ次の穴がありました。

| 穴 | リスク |
| --- | --- |
| **認証** | トークンなし・不正トークンで API が開放される |
| **権限** | 非メンバーが他人のグループの支出を見たり登録したりする |
| **バリデーション** | 配分 100% 未満・不正メンバーなどの不正入力が通る |
| **CI なし** | PR 時にテストを忘れても気づけない |

doc 22 の「今後の拡張候補」で **優先度: 高** としていた 3 項目を、今回まとめて実装しました。

---

## 目的

### 主目的

1. **認証・権限の振る舞いを固定する** — 401 / 403 が正しく返ることを自動検証
2. **支出 API のバリデーションを固定する** — 400 エラーの条件をテストで文書化
3. **PR ごとに品質ゲートを設ける** — GitHub Actions でテスト失敗を検知

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| 実 DB を使う統合テスト | PostgreSQL のテスト環境構築コストが高い。モックで十分カバーできる範囲を先に |
| 全 17 API のテスト | 支出 API がバリデーションの代表例。他 API は同パターンで拡張可能 |
| E2E（Playwright） | 別タスクとして残す |
| Zod 導入 | バリデーション実装の変更はスコープ外。既存の `if` 文の振る舞いをテスト |

---

## 何を実装したか

### 1. 認証テスト — `src/lib/auth.test.ts`（10 件）

#### テスト対象

`src/lib/auth.ts` の認証・権限チェック関数。

#### JWT 関連（6 件）

| テスト | 検証内容 |
| --- | --- |
| トークン生成・検証 | `createToken` → `verifyToken` の往復 |
| 不正トークン | `verifyToken` が `null` を返す |
| ヘッダーなし | `getAuthUserId` が `null` |
| Bearer 以外 | `getAuthUserId` が `null` |
| 有効な Bearer | `userId` を取得 |
| 未認証 | `requireAuthUserId` が `UNAUTHORIZED` を投げる |

#### グループ権限（4 件）

| テスト | 検証内容 |
| --- | --- |
| メンバー確認 OK | `assertGroupMember` がメンバー情報を返す |
| 非メンバー | `assertGroupMember` が `FORBIDDEN` |
| ロール OK | `assertGroupRole` が OWNER を許可 |
| ロール不足 | `assertGroupRole` が MEMBER の OWNER 操作を拒否 |

#### Prisma のモック

`assertGroupMember` / `assertGroupRole` は DB を参照するため、`prisma.groupMember.findUnique` をモックしています。  
**実際の PostgreSQL には接続しません。**

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    groupMember: { findUnique: mockFindUnique },
  },
}));
```

---

### 2. 支出 API テスト — `src/app/api/groups/[groupId]/expenses/route.test.ts`（10 件）

#### テスト対象

`src/app/api/groups/[groupId]/expenses/route.ts` の `GET` / `POST` ハンドラ。

#### モック戦略

| モジュール | モック内容 | 理由 |
| --- | --- | --- |
| `@/lib/auth` | `requireAuthUserId`, `assertGroupMember` | 認証・権限の成功/失敗を個別に制御 |
| `@/lib/prisma` | `groupMember.findMany`, `expense.create` | DB なしでバリデーションと成功パスを検証 |

**ルートハンドラを直接呼び出す**方式です。HTTP サーバーを起動せず、Next.js の `NextRequest` を渡して `GET` / `POST` 関数を実行します。

#### GET（2 件）

| テスト | 期待 |
| --- | --- |
| 未認証 | `401` + `{ error: "認証が必要です" }` |
| 非メンバー | `403` + 閲覧権限なしメッセージ |

#### POST — 認証・権限（2 件）

| テスト | 期待 |
| --- | --- |
| 未認証 | `401` |
| 非メンバー | `403` |

#### POST — バリデーション（5 件）

| テスト | 期待 |
| --- | --- |
| カテゴリ/金額なし | `400` + 必須エラー |
| 配分合計 ≠ 100% | `400` + 配分エラー |
| グループ外メンバーへの配分 | `400` + 不正メンバーエラー |
| 負の配分比率 | `400` |
| 支払いメンバーがグループ外 | `400` |

#### POST — 成功（1 件）

| テスト | 期待 |
| --- | --- |
| 有効な入力 | `201` + 支出 JSON（`expense.create` の戻り値をモック） |

---

### 3. テストヘルパー — `src/test/helpers.ts`

API ルートテストで繰り返し使うユーティリティ。

```ts
// JSON ボディ + Bearer トークン付きリクエスト
createJsonRequest(url, { method: "POST", body: {...}, token: "..." })

// route handler の params 引数
routeParams({ groupId: "group-1" })
```

---

### 4. Vitest セットアップ — `vitest.setup.ts`

JWT テストで秘密鍵を固定するため、テスト実行前に環境変数を設定。

```ts
process.env.JWT_SECRET = "test-secret-for-unit-tests";
```

`auth.ts` はモジュール読み込み時に `JWT_SECRET` を参照するため、テストファイルより先に setup で設定します。

---

### 5. GitHub Actions CI — `.github/workflows/ci.yml`

#### トリガー

- `main` ブランチへの `push`
- すべての `pull_request`

#### 実行ステップ

```yaml
1. checkout
2. Node.js 20 セットアップ（npm キャッシュ有効）
3. npm ci
4. npx prisma generate   # generated client は .gitignore のため CI で生成
5. npm test              # 28 件のユニットテスト
6. npm run lint          # ESLint
```

#### Prisma generate が必要な理由

`src/generated/prisma` は `.gitignore` に入っているため、CI 環境では `prisma generate` でクライアントを生成してからテストを実行します。  
テスト自体は DB に接続しませんが、`GroupRole` などの型・enum を import するために必要です。

---

## テスト構成の全体像

```
src/
├── lib/
│   ├── settlement.test.ts     # 精算ロジック（8 件）— doc 22
│   └── auth.test.ts           # 認証・権限（10 件）— 今回
├── app/api/groups/[groupId]/expenses/
│   ├── route.ts
│   └── route.test.ts          # API バリデーション（10 件）— 今回
└── test/
    └── helpers.ts             # 共通ヘルパー — 今回

.github/workflows/
└── ci.yml                     # CI — 今回

vitest.config.ts
vitest.setup.ts
```

---

## モックを使う理由（統合テストとの違い）

| 方式 | メリット | デメリット |
| --- | --- | --- |
| **モック（今回）** | 高速・DB 不要・CI が簡単 | 実際の Prisma クエリは検証しない |
| **統合テスト（将来）** | DB 制約・リレーションも検証 | PostgreSQL 準備・seed・クリーンアップが必要 |

今回のモックテストは **「ルートハンドラの分岐（401/403/400/201）が正しいか」** に焦点を当てています。  
「DB に正しく保存されるか」は将来の統合テストで補完する想定です。

---

## 変更・追加したファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/lib/auth.test.ts` | 新規 | 認証・権限 10 件 |
| `src/app/api/groups/[groupId]/expenses/route.test.ts` | 新規 | 支出 API 10 件 |
| `src/test/helpers.ts` | 新規 | テストヘルパー |
| `vitest.setup.ts` | 新規 | JWT 秘密鍵の固定 |
| `vitest.config.ts` | 変更 | `setupFiles` 追加 |
| `.github/workflows/ci.yml` | 新規 | CI ワークフロー |
| `docs/23-API認証テストとCI実装まとめ.md` | 新規 | 本ドキュメント |

---

## 他 API にテストを広げるには

支出 API と同じパターンで拡張できます。

1. `vi.mock("@/lib/auth")` で認証・権限を制御
2. `vi.mock("@/lib/prisma")` で DB 操作をモック
3. `createJsonRequest` + `routeParams` でハンドラを直接呼ぶ
4. `res.status` と `res.json()` で振る舞いを検証

候補:

- `POST /api/groups` — グループ作成バリデーション
- `GET /api/groups/:groupId/settlement` — 認証・権限（精算ロジック自体は `settlement.test.ts` でカバー済み）
- `POST /api/auth/login` — 認証失敗時の 401

---

## 今後の拡張候補

| 優先度 | 内容 |
| --- | --- |
| 中 | 他 API ルートへの同パターン展開 |
| 中 | 統合テスト（テスト用 PostgreSQL + Docker） |
| 低 | Playwright E2E |
| 低 | カバレッジレポート（`vitest --coverage`） |

---

## 関連ドキュメント

- [22. 精算ロジック ユニットテスト実装まとめ](./22-精算ロジックテスト実装まとめ.md) — 前回のテスト導入
- `src/lib/auth.ts` — 認証ヘルパー本体
- `src/app/api/groups/[groupId]/expenses/route.ts` — 支出 API 本体
- `docs/11-未実装機能一覧.md` — テスト（Vitest）・CI/CD の項目

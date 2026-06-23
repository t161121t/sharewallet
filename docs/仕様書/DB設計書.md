# ShareWallet DB設計書

> 最終更新: 2026-06-23（`prisma/schema.prisma` の実装内容に基づく）
> DBPMS: PostgreSQL（Supabase） / ORM: Prisma v7（`@prisma/adapter-pg` + `pg`）

## 概要

ShareWallet は「グループ」「メンバー」「支出」「配分」を中心としたシンプルなリレーショナル設計です。**「誰が払ったか」（`Expense.memberId`）と「誰がどれだけ負担するか」（`ExpenseShare`）を分離**しているのが最大の特徴で、これにより記録だけでなく割り勘の精算計算（[`API仕様書.md`](./API仕様書.md)の`GET /settlement`）まで対応しています。

---

## ER図

```
┌──────────┐        ┌────────────────┐        ┌──────────┐
│   User   │──1───N─│  GroupMember   │─N───1──│  Group   │
│          │        │ role: ENUM     │        │          │
└────┬─────┘        │ @@unique       │        └────┬─────┘
     │1             │ [userId,groupId]│             │1
     │              └────────────────┘             │
     │N                                            │N
┌────┴──────┐                                ┌─────┴────┐
│  Expense  │──────────N───────1─────────────│  Group   │
│ memberId  │ (支払者)                       │          │
└────┬──────┘                                └──────────┘
     │1
     │N
┌────┴──────────┐        ┌──────────┐
│ ExpenseShare  │──N───1─│   User   │
│ percent: Float│        │          │
│ @@unique      │        └──────────┘
│[expenseId,    │
│ userId]       │
└───────────────┘

┌────────────────────┐        ┌──────────┐
│  GroupInvitation    │─N───1─│  Group   │
│ token: unique       │        └──────────┘
│ status: ENUM        │
│ createdById ────────┼───1───┌──────────┐
└────────────────────┘        │   User   │
                               └──────────┘
```

---

## テーブル定義

### `users`

| カラム（DB） | プロパティ（コード） | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| name | name | String | NOT NULL | |
| email | email | String | UNIQUE, NOT NULL | ログインID |
| password_hash | passwordHash | String | NOT NULL | bcryptハッシュ（60文字固定） |
| color | color | String | DEFAULT `'#c9a227'` | アバター背景色 |
| avatar_url | avatarUrl | String? | NULL可 | Data URL形式の画像 |
| created_at | createdAt | DateTime | DEFAULT `now()` | |
| updated_at | updatedAt | DateTime | `@updatedAt`（自動更新） | |

**リレーション**: `groups`（GroupMember 1:N）, `expenses`（Expense 1:N, 支払者として）, `shares`（ExpenseShare 1:N）, `createdInvitations`（GroupInvitation 1:N）

---

### `groups`

| カラム（DB） | プロパティ | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| name | name | String | NOT NULL | |
| color | color | String | DEFAULT `'#c9a227'` | テーマカラー |
| icon_url | iconUrl | String? | NULL可 | Data URL（後発カラム。詳細は「設計上の注意点」参照） |
| created_at | createdAt | DateTime | DEFAULT `now()` | |
| updated_at | updatedAt | DateTime | `@updatedAt` | |

**リレーション**: `members`（GroupMember 1:N）, `expenses`（Expense 1:N）, `invitations`（GroupInvitation 1:N）

---

### `group_members`（中間テーブル / RBACの中核）

| カラム（DB） | プロパティ | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| user_id | userId | String | FK→users.id, `onDelete: Cascade` | |
| group_id | groupId | String | FK→groups.id, `onDelete: Cascade` | |
| role | role | GroupRole(enum) | DEFAULT `MEMBER` | `OWNER` \| `ADMIN` \| `MEMBER` |
| created_at | createdAt | DateTime | DEFAULT `now()` | |

**制約**: `@@unique([userId, groupId])` — 同じユーザーが同じグループに二重参加できない。この複合ユニーク制約が**全認可チェック（`assertGroupMember`）の前提**になっている。

---

### `expenses`

| カラム（DB） | プロパティ | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| group_id | groupId | String | FK→groups.id, `onDelete: Cascade` | |
| member_id | memberId | String | FK→users.id, `onDelete: Cascade` | **支払者**（負担者ではない） |
| category | category | String | NOT NULL | enum化せず文字列（型安全はTypeScript側の`CategoryName`で担保） |
| amount | amount | Int | NOT NULL | **円単位の整数**。`Float`を避け丸め誤差を排除 |
| memo | memo | String? | NULL可 | |
| date | date | DateTime | NOT NULL | 支出が発生した日時（登録日時の`createdAt`とは別） |
| created_at | createdAt | DateTime | DEFAULT `now()` | レコード作成日時 |

**リレーション**: `shares`（ExpenseShare 1:N）

**設計上の注目点**: `memberId`（支払者）と`shares`（負担者）を完全に分離している。1人が全額立て替えて、複数人で負担するケース（最も一般的な割り勘シナリオ）をそのまま表現できる。

---

### `expense_shares`（支出の負担配分）

| カラム（DB） | プロパティ | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| expense_id | expenseId | String | FK→expenses.id, `onDelete: Cascade` | |
| user_id | userId | String | FK→users.id, `onDelete: Cascade` | 負担する側のユーザー |
| percent | percent | Float | NOT NULL | 負担割合（%）。**1支出内の合計が100になることをAPI層で検証**（DB制約ではない） |
| created_at | createdAt | DateTime | DEFAULT `now()` | |

**制約**: `@@unique([expenseId, userId])` — 1人のユーザーが同じ支出に対して複数の配分行を持てない。

---

### `group_invitations`

| カラム（DB） | プロパティ | 型 | 制約 | 説明 |
| --- | --- | --- | --- | --- |
| id | id | String | PK, `cuid()` | |
| token | token | String | UNIQUE, NOT NULL | `crypto.randomBytes(16).toString("hex")`（32文字） |
| group_id | groupId | String | FK→groups.id, `onDelete: Cascade` | |
| created_by_id | createdById | String | FK→users.id, `onDelete: Cascade` | 発行者 |
| expires_at | expiresAt | DateTime? | NULL可 | NULLなら無期限 |
| status | status | InvitationStatus(enum) | DEFAULT `ACTIVE` | `ACTIVE` \| `REVOKED` |
| created_at | createdAt | DateTime | DEFAULT `now()` | |

**設計上の注目点**: 招待の無効化（`DELETE /invitations/:id`）は行を消さず`status: REVOKED`に更新する**論理削除**。発行履歴が残り、「誰が・いつ・どのリンクを発行したか」を追跡できる。

---

## Enum定義

```prisma
enum GroupRole {
  OWNER   // 削除・全設定変更・OWNER以外の除外も可能
  ADMIN   // メンバー追加/除外（OWNER除外は不可）・支出編集
  MEMBER  // 自分の支出の編集削除・支出登録・閲覧のみ
}

enum InvitationStatus {
  ACTIVE   // 有効。/invite/:token でアクセス可能
  REVOKED  // 無効化済み（論理削除）
}
```

---

## 命名規則: `@map`によるDBとコードの橋渡し

| 観点 | 規則 | 例 |
| --- | --- | --- |
| コード側（Prisma Client / TypeScript） | camelCase | `passwordHash`, `groupId` |
| DB側（実際のSQL） | snake_case | `password_hash`, `group_id` |

`schema.prisma`の各フィールドに`@map("snake_case名")`、各モデルに`@@map("複数形テーブル名")`を付けることで、両方の言語の命名規則を同時に満たしています。

---

## カスケード削除の設計

すべての外部キーに`onDelete: Cascade`が設定されています。

```
User削除   → GroupMember, Expense(支払者として), ExpenseShare, GroupInvitation(作成者として) も削除
Group削除  → GroupMember, Expense, GroupInvitation も削除
Expense削除 → ExpenseShare も削除
```

**意図**: 「孫レコードだけ残ってグループ無き支出が残る」のようなDB上の不整合を、アプリケーションコードでの削除漏れに依存せず**DB自身が保証する**ようにしている。

**トレードオフ**: User削除が「その人が支払ったExpenseまで一緒に消す」という強い操作になる。退会機能を実装する場合は、本当にCascadeで良いか（履歴は残すべきでは？）の再検討が必要になる箇所。

---

## インデックス / クエリパターンとの関係

明示的な`@@index`はスキーマ上で宣言されていませんが、以下は暗黙的にインデックスされています。

- 各テーブルの`id`（PK）
- `@unique` / `@@unique`が付いたカラム・組み合わせ: `users.email`、`group_members(userId, groupId)`、`expense_shares(expenseId, userId)`、`group_invitations.token`

**現状で頻出するクエリパターン**とインデックスの対応:
| クエリ | 使われる制約/インデックス |
| --- | --- |
| ログイン時の`findUnique({ where: { email } })` | `users.email`のUNIQUE制約由来のインデックス |
| `assertGroupMember`の`findUnique({ userId_groupId })` | 複合UNIQUE制約のインデックス |
| `GET /groups/:id/expenses`の`where: { groupId }` | **インデックス無し**（`expenses.group_id`に明示的な単独インデックスが無い） |
| `GET /dashboard/summary`の`where: { memberId, date }` | **インデックス無し** |

> 改善余地: 支出テーブルが増えてくると`expenses.group_id`と`expenses.member_id`、`date`に複合インデックスを追加するのが次の最適化ポイント（現状はデータ量が小さく問題化していない）。

---

## マイグレーション履歴

| マイグレーション | 内容 |
| --- | --- |
| `20260213144041_init` | 初版スキーマ（SQLite時代） |
| `20260227150405_core_features` | グループ・支出機能の本格実装（`ExpenseShare`等の追加） |
| `20260313000000_init_postgresql` | **PostgreSQL（Supabase）への移行**。SQLite用スキーマを作り直し |
| `20260425170030_add_group_invitations` | `group_invitations`テーブルの追加（招待リンク機能） |

各マイグレーションフォルダ（`prisma/migrations/*/migration.sql`）には実行された生SQLがそのまま保存されており、スキーマ変更の履歴として参照できます。

---

## 接続構成（本DBに関わる運用設定）

| 環境変数 | 用途 | 接続方式 |
| --- | --- | --- |
| `DATABASE_URL` | アプリ実行時の通常接続 | Supabaseプーラー経由 |
| `DIRECT_URL` | `prisma migrate`実行時 | 直接接続（DDL実行のため） |

`src/lib/prisma.ts`が`pg.Pool` + `@prisma/adapter-pg`でPrisma Clientを生成し、`globalThis`にキャッシュするシングルトン構成になっています。接続方式・プーリングの詳細な仕組みは [`../21-バックエンド学習ガイド.md`](../21-バックエンド学習ガイド.md) を参照してください。

---

## 設計上の注意点・既知の制約

| 項目 | 現状 | 補足 |
| --- | --- | --- |
| `category`の型 | DB上は`String`（enum未使用） | アプリ側`CategoryName`型でのみ制約。DBレベルでは任意の文字列が入る余地がある |
| `percent`の合計100%チェック | API層のみ（DB制約なし） | `ExpenseShare`を直接操作するスクリプト等では不整合が作れる |
| `icon_url`カラム | 後発追加のため、Route側に「カラムが無い場合のフォールバック」処理が残っている | マイグレーション定着後に削除候補（`src/app/api/groups/route.ts`の`isUnknownIconUrlError`） |
| 画像データ | `avatar_url` / `icon_url`ともDataURLを直接カラムに保存 | 画像サイズ次第でテーブルが肥大化する。将来的にSupabase Storage等への外部化が検討候補 |
| ソフトデリート | `GroupInvitation`のみ`status`で論理削除。`User` / `Group` / `Expense`は物理削除 | 退会・グループ解散時の履歴保持要件が出た場合は要再設計 |

---

### 関連ドキュメント
- [API仕様書.md](./API仕様書.md) — 各エンドポイントの入出力仕様
- [`../21-バックエンド学習ガイド.md`](../21-バックエンド学習ガイド.md) — ORM・トランザクション・接続プーリングの仕組み解説
- [`prisma/schema.prisma`](../../prisma/schema.prisma) — スキーマ定義の正本

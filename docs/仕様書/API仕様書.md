# ShareWallet API仕様書

> 最終更新: 2026-06-23（`src/app/api/**/route.ts` の実装内容に基づく）
> 旧版（実装初期・モックデータ時点）: [`../07-API仕様書.md`](../07-API仕様書.md)

## 概要

ShareWallet のバックエンドは Next.js の **Route Handler**（`src/app/api/**/route.ts`）として実装されています。データベースは PostgreSQL（Supabase）、ORMはPrisma v7です。

**ベースURL:** `/api`

## 認証方式

`POST /api/auth/login` で取得したJWTを、以降の認証必須エンドポイントの `Authorization` ヘッダーに付与します。

```
Authorization: Bearer <token>
```

- アルゴリズム: HS256（`jose`ライブラリ）
- 有効期限: 7日間
- 認証エラー時は共通で `401` + `{ "error": "認証が必要です" }`

## 共通エラーレスポンス

すべてのエンドポイントは失敗時に同一の形式で返します。

```json
{ "error": "エラーメッセージ（日本語）" }
```

| ステータス | 意味 | 主な発生条件 |
| --- | --- | --- |
| `400` | リクエスト不正 | 必須項目欠落、形式不正、業務ルール違反（配分合計≠100%など） |
| `401` | 認証エラー | トークン無し／期限切れ／署名不正 |
| `403` | 認可エラー | ロール不足、グループ非所属 |
| `404` | 見つからない | 存在しないID、他グループのリソース |
| `409` | 競合 | メールアドレス重複、既に参加済み |
| `410` | 期限切れ | 招待リンクの有効期限切れ |
| `413` | サイズ超過 | レシート画像が1.5MB超 |
| `500` | サーバーエラー | DB接続失敗、外部API（Vision）エラーなど想定外 |

## 共通の型定義

```ts
type CategoryName = "貯金" | "住居" | "交通" | "食費" | "娯楽" | "医療" | "日用品" | "通信" | "美容" | "教育" | "その他";
type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

type GroupMember = { id: string; name: string; color: string; avatarUrl?: string; role?: GroupRole };
type Group = { id: string; name: string; members: GroupMember[]; color: string; iconUrl?: string };
type UserProfile = { id: string; name: string; email: string; color: string; avatarUrl?: string };

type ExpenseShare = { userId: string; percent: number; userName?: string };
type ExpenseRecord = {
  id: string; category: CategoryName; amount: number;
  memberId: string; memberName: string; memberAvatarUrl?: string;
  memo?: string; date: string; shares?: ExpenseShare[];
};

type ApiError = { error: string };
```

完全な型一覧は [`src/types/index.ts`](../../src/types/index.ts) を参照してください（フロントエンド・バックエンド共通で同じ型を import しています）。

---

## エンドポイント一覧

| メソッド | パス | 認証 | 権限 | 概要 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | 不要 | - | 新規ユーザー登録 |
| POST | `/api/auth/login` | 不要 | - | ログイン（JWT発行） |
| GET | `/api/users/me` | 必要 | 本人 | プロフィール取得 |
| PUT | `/api/users/me` | 必要 | 本人 | プロフィール更新 |
| GET | `/api/groups` | 必要 | 所属者 | 自分の所属グループ一覧 |
| POST | `/api/groups` | 必要 | - | グループ作成（作成者がOWNERになる） |
| GET | `/api/groups/:groupId` | 必要 | メンバー | グループ詳細 |
| PUT | `/api/groups/:groupId` | 必要 | OWNER/ADMIN | グループ編集（名前・色・アイコン） |
| DELETE | `/api/groups/:groupId` | 必要 | OWNER | グループ削除 |
| POST | `/api/groups/:groupId/members` | 必要 | OWNER/ADMIN | メールアドレス指定でメンバー追加 |
| DELETE | `/api/groups/:groupId/members/:userId` | 必要 | 本人 or OWNER/ADMIN | メンバー除外・自己脱退 |
| GET | `/api/groups/:groupId/expenses` | 必要 | メンバー | 支出一覧取得 |
| POST | `/api/groups/:groupId/expenses` | 必要 | メンバー | 支出登録（配分付き） |
| PUT | `/api/groups/:groupId/expenses/:expenseId` | 必要 | 本人 or OWNER/ADMIN | 支出編集 |
| DELETE | `/api/groups/:groupId/expenses/:expenseId` | 必要 | 本人 or OWNER/ADMIN | 支出削除 |
| GET | `/api/groups/:groupId/settlement` | 必要 | メンバー | 精算計算結果（最小送金組み合わせ） |
| POST | `/api/groups/:groupId/invitations` | 必要 | OWNER/ADMIN | 招待リンク発行 |
| GET | `/api/groups/:groupId/invitations` | 必要 | OWNER/ADMIN | 有効な招待リンク一覧 |
| DELETE | `/api/groups/:groupId/invitations/:invitationId` | 必要 | OWNER/ADMIN | 招待リンク無効化（REVOKED） |
| GET | `/api/invite/:token` | 不要 | - | 招待リンクの情報を確認（参加前のプレビュー） |
| POST | `/api/invite/:token/accept` | 必要 | - | 招待を受けてグループに参加 |
| GET | `/api/dashboard/summary` | 必要 | 本人 | 今月・前月の個人支出集計 |
| POST | `/api/receipt/analyze` | 必要 | 本人 | レシート画像をOCR解析し金額/カテゴリ/店名を抽出 |
| GET | `/api/health` | 不要 | - | ヘルスチェック（DB未参照の固定応答） |

---

## 各エンドポイント詳細

### POST `/api/auth/register`

新規ユーザーを登録します。

**リクエストボディ**
```json
{ "name": "山田 花子", "email": "yamada@example.com", "password": "password123" }
```

| フィールド | 型 | 必須 |
| --- | --- | --- |
| name | string | ○ |
| email | string | ○ |
| password | string | ○ |

**処理内容**: メール重複チェック → `bcrypt.hash(password, 10)` → `users` テーブルにINSERT。

**レスポンス `200`**
```json
{ "user": { "id": "...", "name": "山田 花子", "email": "yamada@example.com", "color": "#c9a227" } }
```

**エラー**: `400`（必須項目欠落） / `409`（メール重複「このメールアドレスは既に登録されています」）

---

### POST `/api/auth/login`

**リクエストボディ**
```json
{ "email": "tanaka@example.com", "password": "password123" }
```

**処理内容**: `users.email` で検索 → `bcrypt.compare` でパスワード照合 → 一致したら `createToken(userId)`（JWT, HS256, 7日）を発行。

**レスポンス `200`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "...", "name": "田中 太郎", "email": "tanaka@example.com", "color": "#F59E0B" }
}
```

**エラー**: `400`（メール/パスワード未入力） / `401`（「メールアドレスまたはパスワードが正しくありません」※ユーザー不在とパスワード不一致を区別しない）

---

### GET `/api/users/me`

ログイン中ユーザーのプロフィールを返します。`avatarUrl`はDB値が`null`の場合`undefined`として返却（DTO変換）。

**レスポンス `200`**: `UserProfile`
**エラー**: `401` / `404`（トークンは有効だがユーザー削除済みなど）

---

### PUT `/api/users/me`

送信されたフィールドのみ更新します（部分更新／`PATCH`的な振る舞い）。`id`は変更不可。

**リクエストボディ（すべて任意）**
```json
{ "name": "...", "email": "...", "color": "#3B82F6", "avatarUrl": "data:image/jpeg;base64,..." }
```

**レスポンス `200`**: 更新後の `UserProfile`

---

### GET `/api/groups`

ログイン中ユーザーが所属する（`GroupMember`に存在する）グループのみを返します。各グループにメンバー一覧（`role`付き）を含みます。

**レスポンス `200`**: `Group[]`

---

### POST `/api/groups`

**リクエストボディ**
```json
{ "name": "東京シェアハウス", "color": "#c9a227", "iconUrl": "data:image/..." }
```

| フィールド | 型 | 必須 | 備考 |
| --- | --- | --- | --- |
| name | string | ○ | trim後に空文字は不可 |
| color | string | - | `#RRGGBB`形式の検証あり。不正値は `#c9a227` にフォールバック |
| iconUrl | string | - | Data URL |

**処理内容**: グループ作成と同時に作成者を`role: OWNER`の`GroupMember`としてnested writeで同時作成（1トランザクション）。

**レスポンス `201`**: 作成された `Group`（OWNER 1名のみ含む）
**エラー**: `400`（name未指定）

---

### GET `/api/groups/:groupId`

**認可**: `assertGroupMember` — 所属していなければ`403`

**レスポンス `200`**: `Group`
**エラー**: `403` / `404`（グループ自体が存在しない）

---

### PUT `/api/groups/:groupId`

**認可**: `OWNER` または `ADMIN`

**リクエストボディ（すべて任意の部分更新）**
```json
{ "name": "新しい名前", "color": "#3B82F6", "iconUrl": null }
```

`iconUrl: null` を送ると明示的にアイコンを削除できます（`undefined`の場合は変更しない）。

**レスポンス `200`**: 更新後の `Group`

---

### DELETE `/api/groups/:groupId`

**認可**: `OWNER`のみ

グループ削除時、`onDelete: Cascade`制約により紐づく`GroupMember` / `Expense` / `ExpenseShare` / `GroupInvitation`もDB側で自動削除されます。

**レスポンス `200`**: `{ "ok": true }`

---

### POST `/api/groups/:groupId/members`

メールアドレス指定で既存ユーザーをグループに追加します（新規ユーザー作成はしない）。

**認可**: `OWNER` または `ADMIN`

**リクエストボディ**
```json
{ "email": "suzuki@example.com" }
```

**レスポンス `201`**
```json
{ "id": "...", "name": "鈴木", "color": "#3B82F6", "role": "MEMBER" }
```

**エラー**: `404`（該当メールのユーザーが存在しない） / `409`（既に参加済み）

---

### DELETE `/api/groups/:groupId/members/:userId`

メンバー除外、または自分自身の脱退。

**認可ロジック（分岐あり）**:
1. `actorId === userId`（自己脱退）の場合: 本人がOWNERで、かつそのグループのOWNERが自分1人だけなら`400`（「最後のOWNERは脱退できません」）
2. 他人を除外する場合: `OWNER`または`ADMIN`である必要があり、かつ対象が`OWNER`なら自分も`OWNER`でなければ`403`（「OWNERを除外できるのはOWNERのみです」）

**レスポンス `200`**: `{ "ok": true }`
**エラー**: `400` / `403` / `404`（対象メンバー不在）

---

### GET `/api/groups/:groupId/expenses`

**認可**: メンバーであること

支出を`date`の降順で取得し、支払者（`member`）と配分（`shares`、各`createdAt`昇順）を含めて返します。

**レスポンス `200`**: `ExpenseRecord[]`

---

### POST `/api/groups/:groupId/expenses`

**認可**: メンバーであること

**リクエストボディ**
```json
{
  "category": "食費",
  "amount": 1500,
  "memberId": "u1",
  "memo": "ランチ代",
  "shares": [
    { "userId": "u1", "percent": 50 },
    { "userId": "u2", "percent": 50 }
  ]
}
```

| フィールド | 型 | 必須 | 備考 |
| --- | --- | --- | --- |
| category | CategoryName | ○ | |
| amount | number | ○ | 円単位の整数 |
| memberId | string | - | 支払者。未指定ならログイン中ユーザー |
| memo | string | - | |
| shares | `{userId, percent}[]` | - | 未指定なら全メンバーで均等配分（`100 / メンバー数`） |

**バリデーション（DB書き込み前にコードで検証）**:
- `category` / `amount` 必須（`400`「カテゴリと金額は必須です」）
- `shares`の`percent`合計が `100 ± 0.01` でなければ `400`（浮動小数点誤差を許容）
- `shares`内の`userId`がグループ外、または`percent < 0`なら`400`
- `memberId`（支払者）がグループ外なら`400`

**処理内容**: `expense.create({ data: { ..., shares: { create: [...] } } })` でExpenseとExpenseShareをネストしたcreateとして1トランザクションで作成。

**レスポンス `201`**: 作成された `ExpenseRecord`

---

### PUT `/api/groups/:groupId/expenses/:expenseId`

部分更新。`shares`を送る場合は既存配分を全削除して入れ替え（`deleteMany` + `create`）。

**認可**: 支出の本人（`memberId === userId`）、または`OWNER`/`ADMIN`

**レスポンス `200`**: 更新後の `ExpenseRecord`
**エラー**: `404`（支出が存在しない、または別グループのもの）

---

### DELETE `/api/groups/:groupId/expenses/:expenseId`

**認可**: 支出の本人、または`OWNER`/`ADMIN`

**レスポンス `200`**: `{ "ok": true }`

---

### GET `/api/groups/:groupId/settlement`

グループの全支出から「誰が誰にいくら払うべきか」を計算します（`src/lib/settlement.ts`）。

**アルゴリズム概要**:
1. 各メンバーの`balance`を計算: 支払った金額を `+amount`、配分された負担額（`amount × percent / 100`、`shares`未指定の支出は均等割り）を`-`
2. `balance > 0`（もらう側）と`balance < 0`（払う側）に分け、絶対値の降順にソート
3. 最大の債権者と最大の債務者をマッチングし、小さい方の金額を相殺。残額が0になった側を次に進める「貪欲法（greedy）」で**最小送金組み合わせ**を生成

**レスポンス `200`**: `SettlementResult`
```ts
{
  transactions: { fromUserId, fromUserName, toUserId, toUserName, amount, ... }[];
  memberBalances: { userId, userName, balance, ... }[]; // 正=もらう, 負=払う
  totalExpenseAmount: number;
  expenseCount: number;
}
```

---

### POST `/api/groups/:groupId/invitations`

**認可**: `OWNER`または`ADMIN`

**リクエストボディ**
```json
{ "expiresInDays": 7 }
```
省略時のデフォルトは7日。`token`は`crypto.randomBytes(16).toString("hex")`（32文字のランダム16進文字列）。

**レスポンス `201`**
```json
{ "id": "...", "token": "...", "url": "https://.../invite/<token>", "expiresAt": "2026-06-30T...", "createdAt": "...", "status": "ACTIVE" }
```

---

### GET `/api/groups/:groupId/invitations`

**認可**: `OWNER`または`ADMIN`

`status: ACTIVE`の招待のみを作成日時の降順で返します（`REVOKED`は除外）。

---

### DELETE `/api/groups/:groupId/invitations/:invitationId`

物理削除ではなく `status` を `REVOKED` に更新する**論理削除**。

**レスポンス `200`**: `{ "ok": true }`

---

### GET `/api/invite/:token`

**認証不要**（リンクを受け取った未参加者が事前にグループ情報を見られるようにするため）。

`status !== "ACTIVE"`なら`404`、期限切れなら`410`を返します。

**レスポンス `200`**
```json
{ "groupId": "...", "groupName": "...", "groupColor": "...", "memberCount": 4, "createdByName": "田中 太郎", "expiresAt": "..." }
```

---

### POST `/api/invite/:token/accept`

**認証必要**（参加するユーザー自身としてログイン済みである必要がある）

既に参加済みなら何もせず（冪等）成功を返します。未参加なら`role: MEMBER`で`GroupMember`を作成。

**レスポンス `200`**: `{ "groupId": "...", "groupName": "..." }`

---

### GET `/api/dashboard/summary`

ログイン中ユーザー自身が支払った（`memberId === userId`）今月分の支出を集計します。**グループ全体の集計ではなく「自分が支払った分」のみ**が対象である点に注意。

**集計内容**:
- `totalPersonalAmount`: 今月の合計
- `previousMonthTotalPersonalAmount`: 前月の合計（`prisma.aggregate`で`_sum`計算）
- `byGroup`: グループ別の金額降順
- `byCategory`: カテゴリ別の金額降順（旧カテゴリ名「交通費」等は`normalizeCategory`で新名称に変換）

**レスポンス `200`**: `DashboardSummary`

---

### POST `/api/receipt/analyze`

レシート画像をGoogle Cloud Vision API（`DOCUMENT_TEXT_DETECTION`）でOCR解析し、金額・カテゴリ・店名を抽出します。

**リクエストボディ**
```json
{ "image": "data:image/jpeg;base64,..." }
```

- base64データが2,000,000文字（≒1.5MB）を超える場合は`413`
- Vision API呼び出しには`AbortSignal.timeout(9000)`で9秒のタイムアウト

**抽出ロジック**:
- **金額**: 「合計」「お支払い」「お会計」「TOTAL」等の直後の数値を最優先（`confidence: "high"`）。見つからない場合は`¥`付き数値の最大値にフォールバック（`confidence: "low"`）
- **店名**: OCR全文の先頭の意味ある行
- **カテゴリ**: 店名・全文に含まれるキーワード（「スーパー」→食費、「ドコモ」→通信、等9カテゴリ分のマッピング表）でサーバーサイド推定。一致しなければ`"その他"`

**レスポンス `200`**: `ReceiptAnalysisResult`
```json
{ "amount": 702, "category": "食費", "memo": "スーパーマルエツ 渋谷店", "confidence": "high" }
```

**エラー**: `400`（image未指定） / `413`（サイズ超過） / `500`（`GOOGLE_CLOUD_VISION_API_KEY`未設定、Vision APIエラー）

---

### GET `/api/health`

**認証不要**。DBに一切アクセスしない固定レスポンスで、サーバープロセスが起動しているかどけだけを確認する用途。

**レスポンス `200`**: `{ "message": "Hello, World!" }`

---

## 認可ルールのまとめ

| 操作 | 必要な権限 |
| --- | --- |
| グループの閲覧 | メンバー全員（`MEMBER`以上） |
| グループの編集 | `OWNER` / `ADMIN` |
| グループの削除 | `OWNER`のみ |
| メンバー追加 | `OWNER` / `ADMIN` |
| メンバー除外（他人） | `OWNER` / `ADMIN`（対象が`OWNER`なら実行者も`OWNER`必須） |
| 自己脱退 | 本人（ただし最後のOWNERは不可） |
| 支出の登録 | メンバー全員 |
| 支出の編集・削除 | 支出の本人 / `OWNER` / `ADMIN` |
| 招待リンクの発行・無効化・一覧 | `OWNER` / `ADMIN` |
| 招待の受諾 | ログイン済みの誰でも（リンクを知っていれば） |

---

### 関連ドキュメント
- [DB設計書.md](./DB設計書.md) — テーブル構造・ER図
- [`../21-バックエンド学習ガイド.md`](../21-バックエンド学習ガイド.md) — 認証・ORM等の仕組みの解説
- [`src/types/index.ts`](../../src/types/index.ts) — 型定義の正本

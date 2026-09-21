# 35. JWTリフレッシュトークン実装まとめ

## これは何のドキュメント？

[GitHub issue #31](https://github.com/t161121t/sharewallet/issues/31) で行った、アクセストークンの短命化とリフレッシュトークン機構の導入の作業記録です。[24. 認証トークンhttpOnly-Cookie移行まとめ](./24-認証トークンhttpOnly-Cookie移行まとめ.md)で導入したhttpOnly Cookie方式を土台に、その上にリフレッシュの仕組みを追加しています。

---

## まず結論（今回できたこと）

- アクセストークン(JWT)の有効期限を **7日 → 30分** に短縮した
- 30分ごとに再ログインさせるのではなく、別途 **リフレッシュトークン(30日)** をDBで管理し、`POST /api/auth/refresh` でサイレントに新しいアクセストークンへ更新できるようにした
- リフレッシュトークンは **使うたびにローテーション**(古いものを削除し新しいものを発行)し、再利用(リプレイ)を防ぐ
- フロントエンド(`apiClient.ts`)は401を受けたら自動で1回だけリフレッシュを試み、成功すれば元のリクエストを再試行する — ユーザーは何も気づかないままセッションが延長される
- ログアウト時はDB上のリフレッシュトークンも確実に失効させる

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 5 passed / Tests 42 passed(新規 auth.refresh.test.ts 6件を含む)
```

**⚠️ 重要: 本番DBへのマイグレーション未適用**
今回追加した`refresh_tokens`テーブルのマイグレーションは、[25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)のときと同様、本番のSupabase DBにはまだ適用していません。マージ後、人の手で`npx prisma migrate deploy`を実行するまでは、ログイン自体が(DBの`refresh_tokens`テーブルが無く)失敗する状態になります。

---

## 背景 — なぜこの変更が必要だったか

これまでアクセストークン(JWT)は7日間有効なまま、`sharewallet_token`というhttpOnly Cookie1本で認証していました(#21で導入)。この方式には次の課題がありました。

- **有効期限が長い = 漏洩時の被害時間が長い**。万一何らかの経路でトークンが漏れた場合、7日間はそのまま悪用され続けられる。
- **失効(ログアウト)の仕組みがトークン自体にない**。JWTはステートレスな署名付きトークンなので、発行後にサーバー側で「このトークンを無効にする」ことができない。ログアウトはCookieを消すだけで、盗まれたトークンのコピーは有効期限まで使え続けてしまう。

かといってアクセストークンの有効期限を単純に短くするだけだと、30分ごとに再ログインを要求することになりUXが大きく悪化します。この矛盾を解決する標準的な方法が「短命なアクセストークン + 長命だが失効可能なリフレッシュトークン」の組み合わせです。

---

## 選択肢の比較

### リフレッシュトークンの管理方式

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. DB管理(採用)** | `RefreshToken`テーブルにハッシュを保存し、都度DBを照合 | ログアウト時に確実に失効させられる。特定トークンだけを個別に無効化できる | DBアクセスが1回増える(リフレッシュのたび) |
| B. ステートレス(署名付きJWTのみ) | リフレッシュトークンもJWTにし、DBには保存しない | DBアクセス不要で高速 | 発行後は失効させる手段がない(ブロックリストを別途持たない限り、ログアウトしても盗まれたリフレッシュトークンは有効期限まで使えてしまう) |

**Aを採用した理由**: issue本文が「保存・失効管理方法を検討する」ことを明示的に求めており、失効可能性(特にログアウト時に確実に無効化できること)を優先しました。ログイン頻度に対してDBアクセス1回のコストは無視できる規模です。

### ローテーションの有無

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. 毎回ローテーション(採用)** | リフレッシュのたびに古いトークンを削除し新しいものを発行 | 一度使われたトークンは二度と使えないため、盗まれたトークンが後から使われても(正規ユーザーが先に使っていれば)検知・無効化の余地が生まれる | 実装がやや複雑になる。同時に2つのリクエストが同じ古いトークンでリフレッシュしようとすると、2つ目は失敗する(後述のFAQ参照) |
| B. ローテーションなし(同じリフレッシュトークンを使い続ける) | 有効期限までずっと同じ値 | 実装が単純 | 盗まれた場合、正規ユーザー・攻撃者の両方が同じトークンを使い続けられ、盗難に気づく手段がない |

**Aを採用した理由**: リフレッシュトークンは30日と長命であるため、盗難時のリスクを抑える価値がローテーションの実装コストに見合うと判断しました。

---

## 目的

### 主目的

1. トークン漏洩時の悪用可能時間を最小化する(アクセストークンを短命に)
2. ログアウト・盗難時に確実に失効させられる仕組みを持つ(リフレッシュトークンをDB管理・ローテーション)
3. ユーザー体験を損なわない(サイレントな自動リフレッシュ)

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| 複数タブ/複数デバイスでの同時リフレッシュの完全な整合性担保 | クライアント側で同一タブ内の同時リクエストによる二重リフレッシュは`refreshInFlight`のPromiseキャッシュで防いでいるが、別タブ・別デバイスでの競合(片方がローテーションした直後にもう片方が古いトークンでリフレッシュしようとして失敗するケース)までは対応していない。発生した場合はそのタブ側が単に再ログインを求められるだけで、致命的な不具合にはならないため今回は許容した |
| リフレッシュトークンの使用履歴・監視(不審な複数箇所からの利用検知) | 運用開始後にログを見ながら必要性を判断すべき機能であり、今回のスコープ外 |
| 全デバイスからの一斉ログアウト機能(ユーザーIDに紐づく全リフレッシュトークンの一括失効) | UIからの導線がまだ無い。`prisma.refreshToken.deleteMany({ where: { userId } })`で実装自体は容易なので、必要になったタイミングで追加できる |

---

## 何を実装したか

### 1. `RefreshToken`モデル(Prismaスキーマ)

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("refresh_tokens")
}
```

パスワードと同じ考え方で、トークンの生の値は保存せず`sha256`ハッシュのみ保存します。bcryptのような低速ハッシュを使わなかったのは、リフレッシュトークン自体が(パスワードと違って)人間が記憶する低エントロピーな値ではなく`crypto.randomBytes(32)`由来の高エントロピーな乱数値であり、総当たりで復元される心配がないためです。

### 2. `src/lib/auth.ts` — トークンの発行・検証・失効

```ts
const ACCESS_TOKEN_TTL_SECONDS = 60 * 30;       // 30分
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30日

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashRefreshToken(token);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000) },
  });
  return token; // 生の値はCookie用に返す。DBにはハッシュしか残らない
}

export async function rotateRefreshToken(oldToken: string) {
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(oldToken) } });
  if (!existing) return null;
  await prisma.refreshToken.delete({ where: { id: existing.id } }); // 使い捨て
  if (existing.expiresAt <= new Date()) return null;
  const newToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, token: newToken };
}
```

### 3. Cookie設計

| Cookie | httpOnly | path | 有効期限 |
| --- | --- | --- | --- |
| `sharewallet_token`(アクセストークン) | ✓ | `/` | 30分 |
| `sharewallet_refresh_token`(新規) | ✓ | `/api/auth`のみ | 30日 |
| `sharewallet_authed`(UI用フラグ) | ✗ | `/` | 30日(リフレッシュトークンと同じ) |

リフレッシュトークンのCookieを`path: "/api/auth"`に限定しているのがポイントです。こうすることで、この長命なトークンは`/api/auth/refresh`や`/api/auth/logout`など認証まわりのリクエストにしか付与されず、他の一般的なAPIリクエスト(支出登録など)には送信されません。露出範囲を最小化する目的です。

`sharewallet_authed`はアクセストークンの30分ではなく、リフレッシュトークンと同じ30日にしています。これを30分にしてしまうと、実際にはリフレッシュでセッション継続できるはずなのに、UI側(`isAuthenticated()`)が30分ごとに「ログアウト済み」と誤判定してログイン画面へ飛ばしてしまうためです。

### 4. `POST /api/auth/refresh`(新規)

リフレッシュトークンCookieを検証し、有効なら新しいアクセストークン・リフレッシュトークンの両方を発行し直します(ローテーション)。無効・期限切れの場合は401を返し、念のため中途半端に残ったCookieも掃除します。

### 5. `src/lib/apiClient.ts` — 401時の自動リフレッシュ

```ts
async function apiFetch<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const res = await fetch(path, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.includes(path)) {
    const refreshed = await tryRefresh(); // 同時実行は1回にまとめる
    if (refreshed) return apiFetch<T>(path, options, true); // 1回だけ再試行
  }
  ...
}
```

`login`/`register`/`refresh`自体はこの自動リトライの対象外にしています(ログイン失敗を「リフレッシュすれば直る」と誤解して無限にリトライしないため)。

### 6. login/logoutルートの更新

- `login`: `createToken`(アクセス)と`issueRefreshToken`(リフレッシュ)の両方を発行しCookieにセット
- `logout`: リフレッシュトークンCookieを読み、`revokeRefreshToken`でDBから削除してからCookieを破棄

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `prisma/schema.prisma` | 変更 | `RefreshToken`モデル追加、`User`に`refreshTokens`リレーション追加 |
| `prisma/migrations/20260922010000_add_refresh_tokens/` | 新規 | `refresh_tokens`テーブル作成(本番未適用、要`migrate deploy`) |
| `src/lib/auth.ts` | 変更 | アクセストークンTTL短縮、リフレッシュトークンの発行/検証/失効関数、Cookie設計の変更 |
| `src/lib/auth.refresh.test.ts` | 新規 | リフレッシュトークン発行/ローテーション/失効のユニットテスト(6件) |
| `src/app/api/auth/login/route.ts` | 変更 | リフレッシュトークンも発行するよう変更 |
| `src/app/api/auth/logout/route.ts` | 変更 | リフレッシュトークンをDBから失効させるよう変更 |
| `src/app/api/auth/refresh/route.ts` | 新規 | リフレッシュエンドポイント |
| `src/lib/apiClient.ts` | 変更 | 401時の自動リフレッシュ&リトライ |
| `docs/35-JWTリフレッシュトークン実装まとめ.md` | 新規 | 本ドキュメント |

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 5 passed / Tests 42 passed
npx eslint <変更ファイル>  # 警告・エラーなし
```

ローカルDB接続でのログイン→30分待たずにトークン失効を模擬→自動リフレッシュ、という実UI確認は未実施(要ローカルPostgreSQL接続、かつ30分という時間の都合上、手動での実確認は別途行うことを推奨)。

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 中 | `npx prisma migrate deploy`を本番DBに適用 | **未実施(必須)** |
| 中 | middleware.tsでの認証ガード一元化(issue #32)とあわせて、リフレッシュ処理もmiddleware側に寄せられないか検討 | 未着手 |
| 低 | 全デバイスからの一斉ログアウトAPI | 未着手 |
| 低 | リフレッシュトークンの使用ログ・異常検知 | 未着手 |

---

## よくある質問

### Q. 複数のAPIリクエストが同時に401になったらどうなる？

`apiClient.ts`側で`refreshInFlight`という1つのPromiseをキャッシュしており、同時に複数のリクエストが401を受けても`/api/auth/refresh`の呼び出しは1回だけになるようにしています。もしこれをせず愚直に複数回呼んでいたら、1回目のリフレッシュでトークンがローテーション(使い捨て)されてしまい、2回目の呼び出しが「既に使われた古いトークン」を送ることになって失敗してしまいます。

### Q. リフレッシュにも失敗したらどうなる？

`apiFetch`は1回だけリトライした後、通常の401エラーとして`ApiClientError`を投げます。呼び出し元のページは(既存の`isAuthenticated()`チェックや個別のcatch処理を通じて)ログイン画面へのリダイレクトなど、これまで通りの401ハンドリングをすることになります。

### Q. なぜアクセストークンを30分にしたの？15分や1時間ではダメ？

issueの提案(15分〜1時間)の範囲内で、ユーザーの操作の合間にリフレッシュが走る頻度とセキュリティのバランスを取って30分としました。極端に厳格な要件があるわけではないため、運用しながら調整可能な値としています。

---

## 関連ドキュメント

- [GitHub issue #31](https://github.com/t161121t/sharewallet/issues/31)
- [24. 認証トークンhttpOnly-Cookie移行まとめ](./24-認証トークンhttpOnly-Cookie移行まとめ.md)
- [25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)(同じく本番マイグレーション未適用の前例)
- `src/lib/auth.ts` — トークン発行・検証・失効ロジックの実体
- `src/lib/apiClient.ts` — クライアント側の自動リフレッシュ

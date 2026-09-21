# 24. 認証トークン httpOnly Cookie 移行まとめ

## これは何のドキュメント？

[GitHub issue #21](https://github.com/t161121t/sharewallet/issues/21)・[PR #40](https://github.com/t161121t/sharewallet/pull/40) で行った、認証トークンの保存方式の変更(`localStorage` → httpOnly Cookie)の作業記録です。

背景・比較検討した選択肢・実装内容・レビューで指摘されて直した点をまとめています。

---

## まず結論（今回できたこと）

- 認証トークン(JWT)の保存先を `localStorage` から **httpOnly Cookie** に変更した
- ログインは `Set-Cookie` でトークンを払い出し、ログアウトは新設した `POST /api/auth/logout` がサーバー側で Cookie を破棄する
- 移行前に `localStorage` に残っていた旧トークンを、ログイン・ログアウト・アプリ起動時にパージするようにした
- `isAuthenticated()` など既存のクライアント側コード7箇所は変更不要（設計の工夫については後述）

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # 28 件パス
```

---

## 背景 — なぜこの変更が必要だったか

`src/lib/apiClient.ts` はログイントークンを `window.localStorage` に保存していました。localStorage は同一オリジンの JavaScript から自由に読み書きできるため、アプリ内のどこか一箇所にでも XSS(クロスサイトスクリプティング)脆弱性があれば、攻撃者はこのトークンをそのまま読み出して正規ユーザーになりすませます。

sharewallet は支出の割り勘・履歴という金銭情報を扱うため、なりすましによる被害(不正な支出登録の閲覧・改ざん、グループ乗っ取りなど)は経済的実害に直結します。issue #21 はこのリスクを指摘したものです。

### 重要な誤解しやすいポイント

httpOnly Cookie 化は **「XSSが起きてもJWTを直接読み出されにくくする」対策であって、XSSそのものを無害化するものではありません。** XSSされたページ内のスクリプトは、ブラウザが自動付与するCookieに乗じて同一オリジンのAPIを直接叩くこと(セッションライディング)は引き続き可能です。今回の対応は「トークンの持ち出し(コピーして別の場所で使われる)」を防ぐものであり、XSSの混入経路自体(出力エスケープ・依存ライブラリの脆弱性対応・CSP導入など)は別途対策が必要です。この点は最初の実装では説明が甘く、オーナーレビューで指摘されて `auth.ts` / `apiClient.ts` のコメントに明記しました。

---

## 選択肢の比較

issueへの対応前に、3つの案を比較しました。

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. httpOnly Cookieへ全面移行(採用)** | トークンをJSから読めない場所に置く | XSSでのトークン窃取という経路を構造的に塞げる。業界標準 | フロント・バック双方の認証まわりを書き換える必要があり変更範囲が広い |
| B. 保存場所は維持しCSP等で緩和 | localStorageのままCSPを導入 | 変更が小さく早く着手できる | 対症療法。依存ライブラリ自体にXSSがあれば防げず「対策済み」と誤認するリスク |
| C. 対応を見送る | 何もしない | 工数ゼロ | 金銭情報を扱うサービスとしてリスクの大きさに見合わない |

**Aを採用した理由**: 被害が起きた場合の実害の大きさ(金銭・個人情報)に対して、対症療法(B)ではなくリスクを構造的に消せる対応が必要と判断したためです。

---

## 目的

### 主目的

1. **JWTのクライアントサイドからの持ち出しを防ぐ** — httpOnly Cookieに置くことでJSから読めなくする
2. **既存のUIコードへの影響を最小化する** — 認証の中核部分(auth.ts・apiClient.ts・login/logoutルート)に変更を閉じ込める
3. **移行前ユーザーの安全も確保する** — 旧トークンの残留を掃除する

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| CSRFトークンの導入 | Cookieは`SameSite=Lax`にしており、他サイトからの単純なフォーム送信によるCSRFは緩和される。より厳密な対策は別issueとして切り出す余地あり |
| middleware.tsでの認証ガード一元化 | issue #32として別途スコープ化されている既存の未実装機能。今回のCookie移行とは独立して進める |
| リフレッシュトークン機構 | issue #31として別スコープ。今回はトークンの有効期限(7日)はそのまま維持 |

---

## 何を実装したか

### 1. `src/lib/auth.ts` — Cookieの発行・検証

```ts
export const AUTH_COOKIE_NAME = "sharewallet_token";       // httpOnly・本体
export const AUTH_PRESENCE_COOKIE_NAME = "sharewallet_authed"; // 非機密フラグ

export function setAuthCookies(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: TOKEN_TTL_SECONDS,
  });
  res.cookies.set(AUTH_PRESENCE_COOKIE_NAME, "1", {
    httpOnly: false, secure: isProd, sameSite: "lax", path: "/", maxAge: TOKEN_TTL_SECONDS,
  });
}
```

`getAuthUserId` も `Authorization: Bearer` ヘッダーではなく `req.cookies.get(AUTH_COOKIE_NAME)` からトークンを読むように変更しました。

#### なぜ2つのCookieを用意したか

既存のクライアントコードは `isAuthenticated()` を同期的に(awaitなしで)7箇所のページで呼んでおり、これを非同期のAPI呼び出しに置き換えると影響範囲が大きくなります。そこで、

- `sharewallet_token`(httpOnly): 実際の認可に使う本体。JSからは触れない
- `sharewallet_authed`(非httpOnly): 「ログインしているか」の見た目上の判定にだけ使う非機密フラグ

という2段構成にしました。`sharewallet_authed` は攻撃者に読まれても書き換えられても、実際のAPI認可は `sharewallet_token` 側をサーバーが検証して行うため安全です。このおかげで `isAuthenticated()` を呼んでいる既存ページ(dashboard, profile, expense, expense/history, groups/[groupId]/settlement, invite/[token])は **1行も変更せずに済みました。**

### 2. ログイン・ログアウトAPI

- `POST /api/auth/login`: レスポンスボディの `token` フィールドを廃止し、`setAuthCookies()` で `Set-Cookie` 発行に変更
- `POST /api/auth/logout`(新規): `clearAuthCookies()` でCookieを破棄

### 3. `src/lib/apiClient.ts`

- `getToken`/`setToken`/`clearToken`(localStorage実装)を削除
- `isAuthenticated()` は `sharewallet_authed` Cookieの有無で判定
- `apiFetch` は `Authorization` ヘッダーを付けず `credentials: "include"` でCookieを送信
- `purgeLegacyToken()` を追加(後述)

### 4. 旧トークンのパージ(レビュー対応)

移行前にログインしていたブラウザには、旧実装が書き込んだ `localStorage["sharewallet_token"]` が残っている可能性があります。これはXSSで読み出せてしまい、発行から7日間はCookie側と同じ有効期限で使えてしまうため、見つけ次第削除するようにしました。

```ts
function purgeLegacyToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("sharewallet_token");
}
// モジュール読み込み時(=アプリ起動時)に一度実行
purgeLegacyToken();
```

`login()` / `logout()` の実行時にも呼ぶことで、ログイン/ログアウトを経由するユーザーは確実に、それ以外のユーザーもアプリ起動のタイミングで掃除されるようにしています。

---

## レビューで指摘された点と対応

自動レビュー(Codex bot)とオーナー自身のレビューで、以下の指摘を受けて修正しました。

| 指摘 | 何が問題だったか | 対応 |
| --- | --- | --- |
| logout失敗の握りつぶし | `logout()` が `/api/auth/logout` の失敗を`.catch()`で握りつぶし、成功トーストを出して画面遷移していた。共有端末でログアウトしたつもりが実は認証Cookieが有効なまま残る危険があった | `.catch()`を除去して失敗を呼び出し側に伝播。`profile/page.tsx`はtry/catchし、失敗時はエラートーストを出して画面遷移しないよう変更 |
| 旧localStorageトークンの残留 | 移行しただけでは旧トークンが7日間XSSで読める状態のまま残る | 上記の`purgeLegacyToken()`を追加 |
| 「XSSを無害化するわけではない」という説明不足 | コメントが「XSSでトークンが窃取されうる問題を解決する」という書き方で、セッションライディングの余地に触れていなかった | コメントを修正し、対策の射程を正確に記述 |

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/lib/auth.ts` | 変更 | Cookie発行/破棄関数、Cookieベースのトークン読み取り |
| `src/app/api/auth/login/route.ts` | 変更 | `Set-Cookie`でトークン発行 |
| `src/app/api/auth/logout/route.ts` | 新規 | Cookie破棄API |
| `src/lib/apiClient.ts` | 変更 | localStorage実装削除、Cookieベースの判定、旧トークンパージ |
| `src/app/profile/page.tsx` | 変更 | `handleLogout`を非同期化・エラーハンドリング追加 |
| `src/types/index.ts` | 変更 | `LoginResponse`から`token`フィールドを削除 |
| `src/lib/auth.test.ts` | 変更 | Cookie前提のテストに更新 |
| `docs/24-認証トークンhttpOnly-Cookie移行まとめ.md` | 新規 | 本ドキュメント |

**支出・グループ・招待などの機能自体には変更はありません。**

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 3 passed / Tests 28 passed
npx eslint <変更ファイル>  # 警告・エラーなし
```

ローカルDBに接続してのログイン/ログアウトの実UI確認は未実施(要ローカルPostgreSQL接続)。

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 高 | [#22] login/registerへのレート制限 | ✅ 完了(→ [25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)) |
| 中 | JWT_SECRET未設定時のfail-open対策(issue #19) | 未着手 |
| 中 | middleware.tsによる認証ガードの一元化(issue #32) | 未着手 |
| 低 | JWTリフレッシュトークン機構(issue #31) | 未着手 |
| 低 | より厳密なCSRF対策(SameSite=Laxを超える対策) | 未検討 |

---

## よくある質問

### Q. なぜログインAPIのレスポンスボディから`token`を消したの？

トークンをレスポンスボディに含めたまま返すと、それを受け取ったフロントエンドコードが誤って再度どこかに保存してしまう余地(ヒューマンエラー)が残るためです。Cookie経由のみで払い出す設計に統一し、フロントエンドのコードはトークンの値自体を一切扱わないようにしました。

### Q. `sharewallet_authed`フラグを攻撃者が勝手に`document.cookie`で書き換えたらどうなる？

`isAuthenticated()`の判定(リダイレクトするかどうかのUI上の見た目)は変わりますが、実際のAPI呼び出しはサーバー側で`sharewallet_token`(httpOnly)を検証するため、このフラグを書き換えただけでは認可を通過できません。

### Q. `credentials: "include"`は本当に必要？

同一オリジンへのfetchはデフォルト(`same-origin`)でもCookieが送られるため厳密には不要ですが、意図を明示するために付けています。

---

## 関連ドキュメント

- [GitHub issue #21](https://github.com/t161121t/sharewallet/issues/21)
- [GitHub PR #40](https://github.com/t161121t/sharewallet/pull/40)
- [25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)
- `src/lib/auth.ts` — Cookie発行/検証の実体
- `src/lib/apiClient.ts` — クライアント側の認証状態管理

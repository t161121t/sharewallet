# 33. middleware認証ガード実装まとめ

## これは何のドキュメント？

[GitHub issue #32](https://github.com/t161121t/sharewallet/issues/32) で対応した、`src/middleware.ts` による認証ガード一元化の作業記録です。認証Cookie自体は[24. 認証トークンhttpOnly-Cookie移行まとめ](./24-認証トークンhttpOnly-Cookie移行まとめ.md)で導入済みのものをそのまま使っています。

---

## まず結論（今回できたこと）

- `src/middleware.ts` を新設し、`/api/**` へのアクセスを一括でチェックするようにした
- 認証Cookieの検証だけを行う`src/lib/auth-edge.ts`を切り出し、Prisma(Node専用)に依存する既存の`src/lib/auth.ts`とは別モジュールにした(Next.jsのmiddlewareはEdgeランタイムで動くため、Node専用ライブラリをimportできない)
- 各APIルート内の既存の認証チェック(`requireAuthUserId`/`getAuthUserId`)は**そのまま残した**(理由は後述)
- `npx next build`で実際にmiddlewareがEdgeバンドル(40kB)としてビルドされ、Prisma/pgが混入していないことを確認済み

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # 45件パス(新規 middleware.test.ts 9件を含む)
npx next build     # ビルド成功、Middleware 40kB
```

---

## 背景 — なぜこの変更が必要だったか

これまで認証チェックは各APIルートハンドラの冒頭で個別に呼び出されており、呼び出し方も統一されていませんでした。実際、`src/app/api/users/me/route.ts`は他のルート(`requireAuthUserId`をtry/catchで包む方式)と違い、`getAuthUserId`を呼んで手動で401を返す方式になっており、新しいルートを追加する際に「認証チェックを入れ忘れる」リスクが構造的に存在していました。

---

## 選択肢の比較

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. middlewareは早期拒否のみ、userId取得は各ルートに残す(採用)** | middlewareは「Cookieが有効かどうか」だけを判定し、通れば`NextResponse.next()`。各ルートは従来通り自前でuserIdを取得する | 既存17ルートの実装(userIdをどう使っているか)を一切変更せずに済み、リグレッションのリスクが最小。認証チェックの「入れ忘れ」だけは構造的に防げる | JWT検証がmiddlewareとルートの両方で走り、リクエストごとに二重になる(ただしDBアクセスなしの軽い処理) |
| B. 全面的にmiddlewareに寄せる(userIdをヘッダー経由で各ルートに渡す) | middlewareで検証したuserIdをカスタムヘッダーに詰めて各ルートに転送し、ルート側は`requireAuthUserId`を呼ばずヘッダーから読む | 二重検証がなくなる。認証ロジックが完全に一箇所に | 17ルート全てを書き換える必要があり変更範囲・リグレッションリスクが大きい。ルートによってはuserIdだけでなく「認証エラーかどうか」の分岐(401/403の使い分け等)がハンドラ内のロジックと密結合しており、機械的に置き換えるとエラーメッセージの微妙な差異を壊しかねない |

**Aを採用した理由**: このissue自体の目的は「認証チェックの入れ忘れ防止」であり、それはmiddlewareによる早期拒否だけで十分達成できます。Bのメリットである「二重検証の解消」は微小な性能上の話でしかなく、17ルートを書き換えるリスクに見合わないと判断しました。JWT検証はDBアクセスを伴わない軽量な処理(署名検証のみ)のため、二重に行っても実用上のコストはごくわずかです。

---

## 目的

### 主目的

1. 新しいAPIルートを追加した際、認証チェックを入れ忘れても`middleware`が弾いてくれるようにする
2. 既存17ルートの動作を一切変えない(認証チェックのロジックは重複するが、削除はしない)

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| 各ルートの`requireAuthUserId`/`getAuthUserId`呼び出しの削除 | 上記の選択肢比較の通り、リグレッションリスクが大きいため |
| middleware内でのグループ権限チェック(`assertGroupMember`等) | グループ単位の権限はDBアクセス(Prisma)が必要で、Edgeランタイムのmiddlewareでは行えない。これは今後も各ルート側の責務として残る |
| Node.js runtimeでのmiddleware実行への切り替え | Next.jsの実験的機能(`experimental.nodeMiddleware`)に依存することになり、安定性・将来の互換性の観点で避けた。Edge対応のCookie検証だけで目的を達成できるため不要 |

---

## 何を実装したか

### 1. `src/lib/auth-edge.ts`(新規) — Prismaに依存しないJWT/Cookie処理

`src/lib/auth.ts`から、DBアクセスを伴わない関数(`createToken`, `verifyToken`, `setAuthCookies`, `clearAuthCookies`, `getAuthUserId`)と定数(`AUTH_COOKIE_NAME`, `AUTH_PRESENCE_COOKIE_NAME`)をこのファイルに切り出しました。`jose`ライブラリはEdge/Web Crypto対応のため、このファイルはEdgeランタイムから安全にimportできます。

### 2. `src/lib/auth.ts` — 後方互換のためのre-export

既存の17ルートが`import { requireAuthUserId } from "@/lib/auth"`のように参照しているため、`auth.ts`は`auth-edge.ts`から関数を再importしてそのままre-exportする形にしました。これにより**既存のimport文は1行も変更不要**です。Prismaに依存する`requireAuthUserId`(内部で`getAuthUserId`を使うラッパー)、`getGroupMember`、`assertGroupMember`、`assertGroupRole`はこれまで通り`auth.ts`に残しています。

```ts
// src/lib/auth.ts(抜粋)
import { getAuthUserId } from "@/lib/auth-edge";
export { AUTH_COOKIE_NAME, /* ... */ getAuthUserId } from "@/lib/auth-edge";

export async function requireAuthUserId(req: NextRequest): Promise<string> {
  const userId = await getAuthUserId(req);
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}
```

### 3. `src/middleware.ts`(新規)

```ts
const PUBLIC_EXACT_PATHS = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
]);

function isPublicInviteView(pathname: string, method: string): boolean {
  return method === "GET" && /^\/api\/invite\/[^/]+$/.test(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT_PATHS.has(pathname) || isPublicInviteView(pathname, req.method)) {
    return NextResponse.next();
  }
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
```

#### 公開パスの決め方

各APIルートを実際に読んで、認証なしで呼ばれる設計になっているものだけを許可リストに入れました。

| パス | メソッド | 認証不要な理由 |
| --- | --- | --- |
| `/api/health` | 全て | ヘルスチェック用、そもそも機密情報を含まない |
| `/api/auth/login` | POST | ログイン前に呼ぶ必要がある |
| `/api/auth/register` | POST | 登録前に呼ぶ必要がある |
| `/api/auth/logout` | POST | Cookie破棄のみでDB読み書きなし。未ログイン状態で呼ばれても実害がない(既存実装も認証チェックなし) |
| `/api/invite/[token]` | GET のみ | 招待リンクを開いた未ログインユーザーにも「どのグループへの招待か」を表示する必要がある(`src/app/invite/[token]/page.tsx`が未ログイン状態でこのAPIを呼ぶ) |

`POST /api/invite/[token]/accept`(招待の受諾)は正規表現に`/accept`が含まれずマッチしないため、自動的に「認証必須」側に分類されます(既存実装通り、参加処理はログイン必須)。

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/lib/auth-edge.ts` | 新規 | Prismaに依存しないJWT/Cookie処理 |
| `src/lib/auth.ts` | 変更 | `auth-edge.ts`からのre-export + DBアクセスを伴う関数のみ残す |
| `src/middleware.ts` | 新規 | `/api/**`への早期認証ゲート |
| `src/middleware.test.ts` | 新規 | 公開パス・保護パス・正しい/不正なCookieの各パターンのテスト(9件) |
| `docs/33-middleware認証ガード実装まとめ.md` | 新規 | 本ドキュメント |

各APIルートハンドラ自体への変更は一切ありません。

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 5 passed / Tests 45 passed
npx eslint .        # 0 errors, 1 warning(既存・無関係のexpense/page.tsx <img>警告のみ)
npx next build     # ビルド成功。Middleware 40kB、Prisma/pg混入なし
```

middlewareはNext.jsのEdgeランタイムで動くため、Vitestでの実行環境(Node)と完全には一致しません。本番相当の動作確認(実際のCookie送受信を含むE2E)は未実施です。

---

## 今後の拡張候補

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 低 | 各ルートの`requireAuthUserId`呼び出しをmiddleware経由のヘッダー受け渡しに統一(選択肢B) | 見送り(リスクに見合わないと判断) |
| 低 | グループ単位の権限(`assertGroupRole`)も何らかの形でmiddleware層に寄せる | Edgeランタイムの制約上、DBアクセスが必要なため現状は不可 |

---

## よくある質問

### Q. middlewareとルート側で二重に認証チェックすると遅くならない？

JWTの検証は署名の暗号学的検証のみで、DBへの問い合わせを伴いません。ネットワークI/Oがない軽量な処理なので、リクエストあたりのオーバーヘッドは無視できるレベルです。

### Q. なぜ`auth.ts`を直接Edge対応にせず、別ファイルに分けたの？

`auth.ts`は`getGroupMember`など`@/lib/prisma`(内部で`pg`という Node 専用のPostgreSQLドライバを使用)に依存する関数を含んでいます。`pg`はEdgeランタイムでは動作しないため、`auth.ts`をそのまま`middleware.ts`からimportすると、Prisma関連のコードがビルド時にEdgeバンドルへ混入してエラーになるか、実行時に壊れます。DBに依存しない部分だけを`auth-edge.ts`に切り出すことで、既存コードを壊さずにこの制約を回避しました。

### Q. `POST /api/auth/logout`を公開パスにして大丈夫？なりすましでログアウトさせられない？

ログアウトは「Cookieを破棄するだけ」の操作で、他人の情報を読み書きするものではありません。認証済みでない状態で呼ばれても、せいぜい「既にログアウトしている状態のCookieがもう一度破棄される」だけで実害はありません。

---

## 関連ドキュメント

- [GitHub issue #32](https://github.com/t161121t/sharewallet/issues/32)
- [24. 認証トークンhttpOnly-Cookie移行まとめ](./24-認証トークンhttpOnly-Cookie移行まとめ.md)
- `src/lib/auth-edge.ts` — Edge対応のJWT/Cookie処理
- `src/middleware.ts` — 認証ガードの実体

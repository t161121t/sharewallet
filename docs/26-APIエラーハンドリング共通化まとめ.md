# 26. APIエラーハンドリング共通化まとめ

## これは何のドキュメント？

[GitHub issue #24](https://github.com/t161121t/sharewallet/issues/24) への対応記録です。`src/app/api/**/route.ts` 全般に渡ってコピペされていた認証・認可エラーの catch ブロックを、共通クラス + 共通ラッパーに置き換えました。

## まず結論（今回できたこと）

- `src/lib/auth.ts` に `UnauthorizedError` / `ForbiddenError` を新設し、文字列比較(`e.message === "UNAUTHORIZED"`)をやめて `instanceof` で判定できるようにした
- `src/lib/apiError.ts`(新規)に `withApiErrorHandling()` を実装し、401/403/500 の判定とJSONレスポンス生成を1箇所に集約した
- `src/app/api/**/route.ts` のうち、この重複パターンを持っていた **12ファイル・18ハンドラ** を書き換えた
- 各ルートのステータスコード・エラーメッセージ・JSON形状は一切変更していない(振る舞い保存のリファクタ)

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 4 passed / Tests 36 passed
```

## 背景 — なぜこの変更が必要だったか

`requireAuthUserId` / `assertGroupMember` / `assertGroupRole` が投げる `UNAUTHORIZED` / `FORBIDDEN` の `Error` を、ほぼ全てのAPIルートが同じ形の catch ブロックで受け止めていました。

```ts
} catch (e) {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json<ApiError>({ error: "..." }, { status: 403 });
  }
  return NextResponse.json<ApiError>({ error: "..." }, { status: 500 });
}
```

このパターンが18箇所に散らばっていたため、エラー分類のルールを変えたいときに全ファイルを直す必要があり、実際に `users/me` の `PUT` ではこの定型文自体が抜け落ちていました(issue #20)。

## 目的

### 主目的

1. 重複した try/catch の定型文を1箇所の実装に集約する
2. 文字列比較(`e.message === "UNAUTHORIZED"`)よりも型安全な `instanceof` 判定にする
3. 既存の挙動(ステータスコード・メッセージ・JSON形状)は一切変えない

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| `users/me/route.ts` の書き換え | このファイルは元々この重複パターンを持っておらず(`getAuthUserId`を直接呼んで`if (!userId)`で判定する別スタイル)、issue #20 で別途対応中のため対象外とした |
| 400番台のバリデーションエラーの共通化 | issue #24 の対象は認証・認可(401/403)の重複であり、ルート固有の入力検証は範囲外 |
| zodによるスキーマバリデーション導入 | issue #23 の別スコープ |

## 何を実装したか

### 1. `src/lib/auth.ts` — エラークラスの新設

```ts
export class UnauthorizedError extends Error {
  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}
```

`requireAuthUserId` は `throw new Error("UNAUTHORIZED")` の代わりに `throw new UnauthorizedError()` を、`assertGroupMember`/`assertGroupRole` は `ForbiddenError` を投げるようにしました。

### 2. `src/lib/apiError.ts`(新規) — 共通ラッパー

```ts
export function withApiErrorHandling<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>,
  options: { defaultErrorMessage: string; forbiddenMessage?: string }
): (req: NextRequest, ctx: Ctx) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      if (e instanceof ForbiddenError) {
        return NextResponse.json(
          { error: options.forbiddenMessage ?? "この操作を行う権限がありません" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: options.defaultErrorMessage }, { status: 500 });
    }
  };
}
```

401のメッセージ「認証が必要です」は全ルートで完全に同一だったため固定にしましたが、403(権限不足)と500(その他失敗)のメッセージはルートごとの操作内容によって全て異なっていた(「グループを削除する権限がありません」「支出を編集する権限がありません」等)ため、`options`で呼び出し側から渡す設計にしています。

### 3. 各ルートへの適用(Before/After)

**Before**(`src/app/api/groups/route.ts` の例):
```ts
export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    // ...本処理...
    return NextResponse.json<Group[]>(result);
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json<ApiError>({ error: "認証が必要です" }, { status: 401 });
    }
    return NextResponse.json<ApiError>({ error: "グループ一覧の取得に失敗しました" }, { status: 500 });
  }
}
```

**After**:
```ts
export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const userId = await requireAuthUserId(req);
  // ...本処理...
  return NextResponse.json<Group[]>(result);
}, { defaultErrorMessage: "グループ一覧の取得に失敗しました" });
```

書き換えた12ファイル・18ハンドラ:

| ファイル | ハンドラ |
| --- | --- |
| `groups/route.ts` | GET, POST |
| `groups/[groupId]/route.ts` | GET, PUT, DELETE |
| `groups/[groupId]/settlement/route.ts` | GET |
| `groups/[groupId]/members/route.ts` | POST |
| `groups/[groupId]/members/[userId]/route.ts` | DELETE |
| `groups/[groupId]/expenses/route.ts` | GET, POST |
| `groups/[groupId]/expenses/[expenseId]/route.ts` | PUT, DELETE |
| `groups/[groupId]/invitations/route.ts` | POST, GET |
| `groups/[groupId]/invitations/[invitationId]/route.ts` | DELETE |
| `dashboard/summary/route.ts` | GET |
| `invite/[token]/accept/route.ts` | POST |
| `receipt/analyze/route.ts` | POST |

### 4. 既存テストの更新

`groups/[groupId]/expenses/route.test.ts` は `vi.mock("@/lib/auth", ...)` で `@/lib/auth` を丸ごとモックしており、`UnauthorizedError`/`ForbiddenError` がエクスポートされなくなると `apiError.ts` の `instanceof` 判定が壊れます。`vi.importActual` で実体のクラスを引き継ぎつつ関数だけモックする形に変更し、テスト内の `new Error("UNAUTHORIZED")` も `new UnauthorizedError()` に置き換えました。

## 技術的な判断

エラー分類の方法として、大きく2つの選択肢を検討しました。

1. **エラークラスのサブクラス化(今回採用)**: `UnauthorizedError`/`ForbiddenError`という専用クラスを作り、`instanceof`で判定する。
2. **ステータスコードを持つ汎用エラーオブジェクト**: 例えば `throw new ApiRouteError(401, "認証が必要です")` のように、1つの汎用クラスにステータスコードとメッセージを持たせる。

1を採用した理由は、`assertGroupMember`/`assertGroupRole`などの認可ロジックは「メッセージ」を意識せず「権限があるかないか」だけを判定して投げればよく、実際に返すメッセージ(ルートごとに異なる)は呼び出し側(APIルート)の関心事だからです。もし2の設計にすると、`auth.ts`側の関数がAPIレスポンス用の日本語メッセージまで知っている必要が出てきてしまい、認可ロジックとHTTPレスポンスの関心が混ざってしまいます。1の設計なら、`auth.ts`は「誰が/何にアクセスできるか」だけに集中し、実際にユーザーへ見せる文言は各ルートが`withApiErrorHandling`の`options`で決める、という責務分離ができています。

## 今後の拡張候補

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 中 | `users/me/route.ts` を同じ `withApiErrorHandling` パターンに揃える | issue #20 で別対応中 |
| 中 | 入力検証をzod化する | issue #23 の別スコープ |
| 低 | 405(Method Not Allowed)等、他のエラー種別の共通化 | 未検討 |

**マージ時の注意**: このリポジトリでは同時期に issue #20(users/me)・#25(groups の SQLite互換コード削除)なども並行してPR化されています。それらも `src/app/api/**` の同じファイル群に触れているため、このPRとマージ順によってはコンフリクトが発生します。人間によるマージ時に解消してください。

## よくある質問

### Q. `withApiErrorHandling`はなぜジェネリクス`<Ctx>`を取るの？

Next.jsの動的ルート(`[groupId]`など)は `(req, { params })` の2引数、静的ルート(`/api/groups`など)は `(req)` の1引数と、ハンドラのシグネチャがルートによって異なるためです。`Ctx`をジェネリクスにすることで、両方のパターンに同じラッパーを使い回せます。

### Q. 401のメッセージだけ固定にしたのはなぜ？

実際に全18箇所を調査した結果、401のメッセージは「認証が必要です」で完全に統一されていましたが、403と500のメッセージは操作内容(グループ削除・支出編集・招待作成など)ごとに全て異なっていたためです。

## 関連ドキュメント

- [GitHub issue #24](https://github.com/t161121t/sharewallet/issues/24)
- `src/lib/apiError.ts` — 共通ラッパーの実体
- `src/lib/auth.ts` — エラークラス定義

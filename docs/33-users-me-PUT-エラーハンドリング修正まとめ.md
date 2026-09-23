# 33. users/me PUT エラーハンドリング修正まとめ

## これは何のドキュメント？

[GitHub issue #20](https://github.com/t161121t/sharewallet/issues/20) で行った、`PUT /api/users/me` のエラーハンドリング修正の作業記録です。

---

## まず結論（今回できたこと）

- `GET`/`PUT /api/users/me` を、他のAPIルート(`groups`, `expenses`など)と同じ「`requireAuthUserId` + try/catch + `ApiError`形式」のパターンに揃えた
- `email`更新時に簡易な形式バリデーションを追加した
- メールアドレス重複時のPrismaユニーク制約違反(`P2002`)を捕捉し、生の500エラーではなく409の`ApiError`を返すようにした
- ルートハンドラを直接呼び出すユニットテストを新規追加(11件)

```bash
npx vitest run   # 53件パス(新規11件を含む)
```

---

## 背景 — なぜこの変更が必要だったか

`src/app/api/users/me/route.ts` はこのリポジトリで唯一、try/catchで囲まれていないAPIルートでした。特に`PUT`ハンドラは`body.email`をそのまま更新に使っており、形式チェック・重複チェックがありませんでした。既存ユーザーと重複するメールアドレスに変更しようとすると、Prismaのユニーク制約違反(`P2002`)がそのまま未処理例外として投げられ、Next.jsのデフォルトエラーハンドリング(生の500・スタックトレース混じりのレスポンス)に落ちていました。

他の全ルート(`groups`, `expenses`など)は`try/catch`で`ApiError`形式のJSONを返しているのに対し、このルートだけ挙動が異なり、クライアント側で想定外のレスポンス形式を受け取る可能性がありました。

---

## 選択肢の比較

このルートには本質的に2つの直し方がありました。

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. `requireAuthUserId`+try/catchに統一(採用)** | `getAuthUserId`(nullチェック方式)をやめ、`groups`/`expenses`と同じ「投げる方式+try/catch」に揃える | GET/PUTとも他ルートと完全に同じ構造になり、以後ハンドラが増えても迷わず同じパターンを踏襲できる | `GET`側も一緒に書き換える必要があり、issue本文が明示していた範囲(PUTのみ)より変更が少し広がる |
| B. `getAuthUserId`は維持し、PUTの中身だけtry/catchで囲む | 認証部分は変更せず、PUTのエラーハンドリングだけ追加する | 変更差分が最小になる | GET/PUTで認証エラーの伝え方(null返却 vs 例外)が混在したままになり、「他ルートとの表記ゆれ」という根本原因が残る |

**Aを採用した理由**: issue本文が「他の全ルートと同様にtry/catchで包む」ことを明示的に求めており、`getAuthUserId`のnullチェック方式は結局「他ルートとの表記ゆれ」の根本原因でもあったため、GET/PUTとも根本から揃えることにしました。

---

## 目的

### 主目的

1. 他のルートと同じエラーハンドリングの型に揃え、挙動の一貫性を保つ
2. メールアドレス重複時に、生の500ではなく意味のある409エラーを返す
3. 最低限の形式バリデーションでユーザー体験を改善する

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| zodなどのスキーマバリデーション導入 | issue #23として別スコープ化されている全ルート共通の課題。このPUTだけ先取りで導入すると、他ルートとの実装方針の不整合が生まれるため見送った |
| 共通の`withApiErrorHandling`ラッパー導入 | issue #24として別スコープ化されている。try/catchの重複自体はこのPRの対象外 |
| メールアドレスの大文字小文字正規化 | スコープ外の別課題(レート制限PRのレビューで指摘された`login`側の課題と同種)。既存の`register`ルートと同じ挙動(大文字小文字区別)に揃えるだけに留めた |

---

## 何を実装したか

### `src/app/api/users/me/route.ts`

`getAuthUserId`(nullチェックで自前401を返す方式)から`requireAuthUserId`(投げる方式)に変更し、`groups/route.ts`と同じtry/catchパターンに統一しました。

```ts
export async function PUT(req: NextRequest) {
  try {
    const userId = await requireAuthUserId(req);
    const body = await req.json().catch(() => null);
    if (!body) { /* 400 */ }

    if (body.email !== undefined && !EMAIL_PATTERN.test(body.email)) {
      return NextResponse.json<ApiError>(
        { error: "メールアドレスの形式が正しくありません" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: { ... } });
    return NextResponse.json<UserProfile>({ ... });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") { /* 401 */ }
    if (isUniqueConstraintError(e)) {
      return NextResponse.json<ApiError>(
        { error: "このメールアドレスは既に使用されています" },
        { status: 409 }
      );
    }
    return NextResponse.json<ApiError>({ error: "プロフィールの更新に失敗しました" }, { status: 500 });
  }
}
```

`isUniqueConstraintError`は、PrismaClientの生成コードを直接importせず(型のimportのみで依存を増やしたくなかったため)、Prismaのエラーオブジェクトが持つ`code === "P2002"`のダックタイピングで判定しています。

`GET`も同様に`requireAuthUserId` + try/catchへ統一しました(issueはPUTのみ言及していますが、「このルートだけ挙動が異なる」という問題自体はGETにも該当するため)。

### テスト — `src/app/api/users/me/route.test.ts`(新規)

`src/app/api/groups/[groupId]/expenses/route.test.ts`と同じ「ルートハンドラを直接呼び出し、`@/lib/prisma`と`@/lib/auth`をモックする」方式で追加しました。P2002エラーは`Object.assign(new Error(...), { code: "P2002" })`で模擬しています。

---

## レビューで指摘された点と対応

計2回のレビューで、合計5点の指摘を受けました。

| 指摘 | 何が問題だったか | 対応 |
| --- | --- | --- |
| **`name`/`color`/`avatarUrl`が未検証** | `email`だけ形式チェックを追加していたが、`name`/`color`/`avatarUrl`はノーチェックで`prisma.user.update`に渡していた。参照元にした`groups/[groupId]/route.ts`のPUTは`name`のtrim+空文字チェック、`color`のhex正規表現チェックを行っているのに、統一したはずの`users/me`側だけ抜け落ちていた。空文字の`name`で表示名を消せてしまう、非hex文字列の`color`がそのまま保存されUIが壊れる、`color`に数値など非文字列を渡すと`PrismaClientValidationError`が汎用catchに落ちて意味のない500になる、といった問題があった | `name`(trim後空文字なら400)・`color`(`/^#[0-9A-Fa-f]{6}$/`にマッチしなければ400)・`avatarUrl`(stringでもnullでもなければ400)のバリデーションを追加。あわせて保存前の`name`もtrimするよう修正 |
| **docsに「選択肢の比較」セクションがない** | PR本文では2つの実装方針(`requireAuthUserId`統一 vs `getAuthUserId`維持)を検討していたが、CLAUDE.mdが要求する`## 選択肢の比較`セクションがドキュメントになかった | 本ドキュメントに追加(上記参照) |
| **`email`/`color`の型チェックが正規表現だけに依存していた(最重要)** | `EMAIL_PATTERN.test(body.email)`・`COLOR_PATTERN.test(body.color)`はJSの型強制(`String(value)`)経由で評価されるため、`{"email": ["x@y.com"]}`のような単一要素配列を渡すと`String(["x@y.com"]) === "x@y.com"`となり正規表現チェックを素通りしてしまう。この場合、配列がそのまま`prisma.user.update`に渡り、Prismaのクライアント側バリデーションで弾かれて意味のない500になる(意図した400にならない)。直前に追加した`name`のチェックは`typeof`を先にガードしていたが、既存の`email`と新規の`color`にはそのガードがなかった | `email`/`color`とも`typeof body.xxx !== "string"`を正規表現チェックの前に追加。テストも追加(配列を渡して400になることを確認) |
| `COLOR_PATTERN`が`groups/[groupId]/route.ts`のhex正規表現と重複 | 同じ正規表現が2箇所に独立して存在し、将来ルールを変える際に片方だけ直し忘れるリスクがある | 対応せず(意図的にスキップ)。この修正は`groups`側のファイルにも手を入れる必要がありスコープが広がる上、影響は「将来ルール変更時に同期し忘れるリスク」という低頻度なものに留まるため、共有バリデータへの切り出しは別issueとして扱う方が適切と判断した |

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/app/api/users/me/route.ts` | 変更 | try/catch統一、emailバリデーション、P2002ハンドリング |
| `src/app/api/users/me/route.test.ts` | 新規 | ユニットテスト11件 |
| `docs/33-users-me-PUT-エラーハンドリング修正まとめ.md` | 新規 | 本ドキュメント |

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 6 passed / Tests 53 passed
npx eslint <変更ファイル>  # 警告・エラーなし
```

---

## よくある質問

### Q. なぜ`getAuthUserId`から`requireAuthUserId`に変えたの？挙動は変わらない？

`getAuthUserId`はnullを返すだけで、呼び出し側が自分で401を組み立てる必要がありました。`requireAuthUserId`は未認証時に`Error("UNAUTHORIZED")`を投げ、catchブロックで他のルートと全く同じ形で401に変換します。ユーザーから見た挙動(401 + `{ error: "認証が必要です" }`)は変わりません。

### Q. `zod`を入れなかったのはなぜ？

入力検証の一貫性の話は issue #23 で全ルート横断の課題として扱われています。このPRだけ先に`zod`を導入すると、他のルートとバリデーション方式がバラバラなまま増えてしまうため、今回は最小限の形式チェックに留めました。

---

## 関連ドキュメント

- [GitHub issue #20](https://github.com/t161121t/sharewallet/issues/20)
- `src/app/api/groups/route.ts` — 揃えた元になったtry/catchパターン
- `src/app/api/auth/register/route.ts` — 重複メールのメッセージのトーンを揃えた参照元

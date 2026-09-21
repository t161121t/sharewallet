# 30. users/me PUT エラーハンドリング修正まとめ

## これは何のドキュメント？

[GitHub issue #20](https://github.com/t161121t/sharewallet/issues/20) で行った、`PUT /api/users/me` のエラーハンドリング修正の作業記録です。

---

## まず結論（今回できたこと）

- `GET`/`PUT /api/users/me` を、他のAPIルート(`groups`, `expenses`など)と同じ「`requireAuthUserId` + try/catch + `ApiError`形式」のパターンに揃えた
- `email`更新時に簡易な形式バリデーションを追加した
- メールアドレス重複時のPrismaユニーク制約違反(`P2002`)を捕捉し、生の500エラーではなく409の`ApiError`を返すようにした
- ルートハンドラを直接呼び出すユニットテストを新規追加(6件)

```bash
npx vitest run   # 44件パス(新規6件を含む)
```

---

## 背景 — なぜこの変更が必要だったか

`src/app/api/users/me/route.ts` はこのリポジトリで唯一、try/catchで囲まれていないAPIルートでした。特に`PUT`ハンドラは`body.email`をそのまま更新に使っており、形式チェック・重複チェックがありませんでした。既存ユーザーと重複するメールアドレスに変更しようとすると、Prismaのユニーク制約違反(`P2002`)がそのまま未処理例外として投げられ、Next.jsのデフォルトエラーハンドリング(生の500・スタックトレース混じりのレスポンス)に落ちていました。

他の全ルート(`groups`, `expenses`など)は`try/catch`で`ApiError`形式のJSONを返しているのに対し、このルートだけ挙動が異なり、クライアント側で想定外のレスポンス形式を受け取る可能性がありました。

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

`src/app/api/groups/[groupId]/expenses/route.test.ts`と同じ「ルートハンドラを直接呼び出し、`@/lib/prisma`と`@/lib/auth`をモックする」方式で6件追加しました。P2002エラーは`Object.assign(new Error(...), { code: "P2002" })`で模擬しています。

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/app/api/users/me/route.ts` | 変更 | try/catch統一、emailバリデーション、P2002ハンドリング |
| `src/app/api/users/me/route.test.ts` | 新規 | ユニットテスト6件 |
| `docs/30-users-me-PUT-エラーハンドリング修正まとめ.md` | 新規 | 本ドキュメント |

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 5 passed / Tests 44 passed
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

# 26. JWT_SECRET未設定時のfail-closed化まとめ

## これは何のドキュメント？

[GitHub issue #19](https://github.com/t161121t/sharewallet/issues/19)・[PR #43](https://github.com/t161121t/sharewallet/pull/43) で行った、`JWT_SECRET`環境変数が未設定のときの挙動をfail-open(危険なデフォルト値へフォールバック)からfail-closed(本番では起動/初回アクセス時に例外で止める)へ変更した作業の記録です。[25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)に続く認証まわりのセキュリティ対応です。

---

## まず結論（今回できたこと）

- 本番環境(`NODE_ENV === "production"`)で`JWT_SECRET`が未設定の場合、既知の固定文字列へのフォールバックを禁止し、実際にJWTを扱う初回アクセス時に例外を投げて落ちるようにした
- 開発環境ではこれまで通り`"dev-secret-change-in-production"`にフォールバックし、開発体験は変えていない
- レビュー指摘を受け、チェックのタイミングを「モジュール読み込み時」から「初回のJWT生成/検証時」に変更し、`next build`が壊れないようにした
- Vercel CLIで本番環境に`JWT_SECRET`が設定済みであることを確認した上でマージした

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 5 passed / Tests 40 passed
npx eslint <変更ファイル>  # 警告・エラーなし
JWT_SECRET未設定 + NODE_ENV=production で next build --turbopack が成功することを確認
```

---

## 背景 — なぜこの変更が必要だったか

`src/lib/auth.ts`は`JWT_SECRET`環境変数が未設定の場合、固定文字列`"dev-secret-change-in-production"`にフォールバックしてJWTの署名・検証を行っていました(fail-open)。

```ts
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production"
);
```

この文字列はソースコードに書かれており誰でも読めます。本番環境で`JWT_SECRET`の設定を忘れた場合、このデフォルト値がそのまま使われ続け、攻撃者は既知のこの文字列でJWTを偽造し、任意のユーザーになりすませてしまいます。issue #19として報告されました。

sharewalletは友人・家族間の割り勘アプリで、なりすましを許すと他メンバーの支出履歴やグループ情報まで自由に閲覧・改ざんされ得るため、「設定漏れに気づかず動き続けてしまう」状態は避ける必要がありました。

---

## 選択肢の比較

対応方法として、大きく2つの選択肢を検討しました。

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. モジュール読み込み時に例外(初期実装)** | `src/lib/auth.ts`が最初にimportされたタイミングで即座に例外を投げる | 設定漏れがあれば実際にJWTを扱う前の時点で確実に気付ける | レビューで判明: Next.jsの`next build`はページデータ収集のためAPI routeモジュールを経由してこのファイルをimportするため、ビルド時に`JWT_SECRET`が参照できない構成だとビルド自体が失敗する |
| B. JWT生成・検証のたびに毎回チェック | `createToken`/`verifyToken`の呼び出しごとに`JWT_SECRET`の有無を確認する | 実装は素直 | チェック漏れの関数を追加したときに同じ穴を再度作り得る。また「起動時に確実に落ちる」という即時性が弱まる |
| **C. 遅延初期化(最終採用)** | チェック自体はAと同じだが、評価タイミングを「初回のJWT生成/検証時」まで遅らせ、結果をメモ化する | Aの「1箇所に集約」「実際に使われる前に確実に落ちる」という利点を保ちつつ、モジュールをimportしただけでは落ちないため`next build`を壊さない | チェック箇所は1つのまま(デメリットなし) |

最終的にCを採用しました。Aは「issueの期待する起動時/初回アクセス時に落とす」という要件を一見満たしているように見えましたが、Next.jsのビルドプロセスが対象モジュールを機械的にimportするという実装の副作用まで考慮できていませんでした。CはBの「チェック箇所が分散する」問題を避けつつ、Aの「importされただけでビルドが壊れる」問題を回避しています。

---

## 目的

### 主目的

1. 本番環境での`JWT_SECRET`設定漏れを、なりすましが可能な状態のまま動かさず、確実にエラーとして検知できるようにする
2. 開発環境の利便性(環境変数を都度設定しなくても動く)は維持する
3. `next build`などビルドプロセスを壊さない

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| デフォルト値の文字列自体を複雑にする | 開発環境用のプレースホルダーとして機能すればよく、文字列を複雑にしても「本番で使われたら危険」という本質は変わらない。実装のシンプルさを優先し値は据え置いた |
| `JWT_SECRET`の長さ・強度のバリデーション | 今回のスコープは「未設定時のfail-open」の解消であり、弱いシークレットの検知は別issueとして扱う方が変更範囲が明確 |
| ビルド時に`JWT_SECRET`の有無を警告する仕組み | Next.jsのビルド時フェーズ判定(`NEXT_PHASE`等)を使えば可能だが、今回は「評価タイミングを遅らせる」だけで実害(ビルド失敗)を防げたため、追加の複雑さを持ち込まなかった |

---

## 何を実装したか

### 1. `src/lib/auth.ts` — 遅延初期化によるfail-closed

```ts
// 開発環境でのみ使う既知のデフォルト値。本番でこれが有効になると、
// 誰でもこの文字列でJWTを偽造しログイン状態を乗っ取れてしまうため、
// 本番(NODE_ENV=production)では絶対に使わせない(下のチェックでfail-closed)。
const DEV_ONLY_FALLBACK_SECRET = "dev-secret-change-in-production";

let cachedSecret: Uint8Array | null = null;

/**
 * JWTの署名/検証キーを取得する。あえてモジュール読み込み時ではなく、
 * ここ(初回のJWT生成/検証時)まで評価を遅らせている。`next build` は
 * ページデータ収集のために各 route ハンドラ経由でこのモジュールをimportするが、
 * 実際にトークンを扱うわけではないため、ビルド時に環境変数が参照できない
 * 構成(例: ビルド専用コンテナに実行時シークレットが渡らない構成)でも
 * ビルド自体は失敗させず、実際に使われる初回アクセス時にfail-closedさせる。
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const envSecret = process.env.JWT_SECRET;
  if (!envSecret && process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET が設定されていません。本番環境では既知のデフォルト値へのフォールバックを許可していないため、" +
        "環境変数 JWT_SECRET に十分な長さのランダムな値を設定してください。"
    );
  }

  cachedSecret = new TextEncoder().encode(envSecret ?? DEV_ONLY_FALLBACK_SECRET);
  return cachedSecret;
}
```

`createToken`/`verifyToken`は、モジュールスコープの定数`SECRET`を直接参照する代わりに`getSecret()`を呼び出すよう変更しました。初回呼び出し時にチェックが走り、以降は`cachedSecret`をそのまま返すため、リクエストのたびに環境変数を再読込するコストはありません。

### 2. `src/lib/auth.secret.test.ts` — テストケースの更新

チェックのタイミング変更に合わせ、テストも「importでrejectする」ではなく「importは成功し、`createToken`呼び出しでrejectする」という期待値に修正しました。

```ts
it("本番環境でJWT_SECRET未設定でもモジュールの読み込み自体は成功する(next build対策)", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.JWT_SECRET;

  await expect(import("@/lib/auth")).resolves.toBeDefined();
});

it("本番環境でJWT_SECRET未設定なら初回のトークン生成時に例外を投げる", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.JWT_SECRET;

  const { createToken } = await import("@/lib/auth");
  await expect(createToken("user-1")).rejects.toThrow("JWT_SECRET");
});
```

本番環境でSECRET設定済みなら正常動作すること、開発環境ではフォールバックすることの2パターンも、同様に`createToken`経由でのアサーションに変更しています。

---

## レビューで指摘された点と対応

`/code-review 43`によるレビューで2点の指摘を受けました。

| 指摘 | 何が問題だったか | 対応 |
| --- | --- | --- |
| **モジュール読み込み時の即時throwが`next build`を壊しうる(最重要)** | 初期実装は`src/lib/auth.ts`のトップレベルで`throw`していた。Next.jsは`next build`のページデータ収集ステップでAPI routeモジュール経由でこのファイルをimportするため、ビルド時に`JWT_SECRET`が参照できない構成(例: ビルド専用コンテナに実行時シークレットが渡らない構成)だとビルド自体が失敗する。このリポジトリのCI(`.github/workflows/ci.yml`)は`test`と`lint`のみで`next build`を実行しないため、マージ前には検出されない | チェックを`getSecret()`関数内に移し、初回のJWT生成/検証時まで評価を遅延。importしただけでは例外が発生しないようにした。`JWT_SECRET`未設定 + `NODE_ENV=production`で`next build --turbopack`が成功することを実際に確認済み |
| **`docs/`配下に学習用ドキュメントがない** | CLAUDE.mdのルールで、セキュリティ対応を含む実装完了時は`docs/<連番>-...md`の作成が必須だが、PR #43には含まれていなかった | 本ドキュメント(`docs/26-...`)を追加 |

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/lib/auth.ts` | 変更 | `JWT_SECRET`未設定時のfail-closaseチェックを追加。レビュー対応で遅延初期化(`getSecret()`)に変更 |
| `src/lib/auth.secret.test.ts` | 新規 | 本番fail-closed・本番設定済み・開発フォールバックの3パターンをテスト(遅延初期化に合わせ4件に整理) |
| `docs/26-JWT_SECRET未設定時のfail-closed化まとめ.md` | 新規 | 本ドキュメント |

---

## 動作確認

```bash
npx tsc --noEmit
# エラーなし

npx vitest run
# Test Files  5 passed (5)
# Tests  40 passed (40)

npx eslint src/lib/auth.ts src/lib/auth.secret.test.ts
# 警告・エラーなし

env -u JWT_SECRET npx next build --turbopack
# ✓ Generating static pages (21/21) など、ビルド成功
# (修正前の実装だとトップレベルthrowによりこの手順でビルドが失敗していたはず)
```

加えて、Vercel CLI(`vercel env ls production`)で本番環境に`JWT_SECRET`が設定済み(193日前に作成)であることを確認した上でマージしました。

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 中 | `JWT_SECRET`の最小長・強度バリデーション(短すぎる値の拒否) | 未着手 |
| 低 | ビルド時フェーズ(`NEXT_PHASE`)を判定し、ビルド専用ログに「本番シークレット未設定」の警告を出す仕組み | 未検討 |
| 低 | 他の環境変数(`DATABASE_URL`等)についても同様のfail-closedパターンを横展開するか検討 | 未検討 |

---

## よくある質問

### Q. なぜモジュール読み込み時のthrowだとダメだったの？「起動時に落ちる」のが目的では？

issueが期待していたのは「設定漏れのまま危険な状態で動き続けない」ことで、`import`という実装の詳細まで縛る意図ではありませんでした。Next.jsのビルドはアプリを実際に起動していないにもかかわらず、型情報やルート設定を集めるために各routeファイルをimportします。ここで例外を投げると「起動」ではなく「ビルド」が落ちてしまい、本番Vercelデプロイでは`JWT_SECRET`をVercel側に設定していても、他の環境(CI上でのビルド確認、Dockerビルドなど)を追加した瞬間に予期せず失敗しうる状態でした。初回のJWT生成/検証時まで評価を遅らせることで、「実際にアプリが動き出してトークンを扱う最初の瞬間に確実に落ちる」という当初の意図を保ったまま、ビルドという別の実行フェーズを巻き込まないようにしています。

### Q. `cachedSecret`をモジュールスコープの`let`にしているのはなぜ？

毎回`process.env.JWT_SECRET`を読んで`TextEncoder`でエンコードし直すのは無駄なコストなので、初回呼び出しの結果をメモ化しています。テストでは`vi.resetModules()`を`beforeEach`で呼んでいるため、テストケースごとにモジュールが再読込され、`cachedSecret`もリセットされます。

### Q. 今回のデプロイでは結局ビルドは落ちなかったのでは？

その通りです。Vercelの本番環境には既に`JWT_SECRET`が設定済みだったため、修正前の実装(モジュール読み込み時throw)でも今回のデプロイ自体は失敗しなかった可能性が高いです。ただし、CIが`next build`を実行していないためこの種の回帰はレビューでしか検出できず、将来ビルド専用の環境(実行時シークレットが渡らない構成)が追加された場合に初めて発覚する潜在的なリスクでした。顕在化する前に直しておく価値があると判断し、レビュー指摘の時点で対応しました。

---

## 関連ドキュメント

- [GitHub issue #19](https://github.com/t161121t/sharewallet/issues/19)
- [GitHub PR #43](https://github.com/t161121t/sharewallet/pull/43)
- [25. ログイン登録レート制限実装まとめ](./25-ログイン登録レート制限実装まとめ.md)
- `src/lib/auth.ts` — 今回変更したJWT生成/検証ロジックの実体

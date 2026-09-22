# 27. Vercel本番ビルド失敗の修正(postinstallでprisma generate)

## これは何のドキュメント？

PR #43([26. JWT_SECRET未設定時のfail-closed化まとめ](./26-JWT_SECRET未設定時のfail-closed化まとめ.md))をmainにマージした直後、Vercelの自動デプロイが失敗し本番サイトがダウンしていることが発覚した際の緊急対応の記録です。対応PRはこのドキュメント作成と同時に作成しています。

---

## まず結論（今回できたこと）

- `package.json`に`"postinstall": "prisma generate"`を追加し、Vercelのクリーンな本番ビルド環境でもPrismaクライアントが生成されるようにした
- `node_modules`と生成済みPrismaクライアント(`src/generated/prisma`)を削除した状態から`npm install` → `next build --turbopack`を実行し、Vercelのビルド環境を再現した上で成功することを確認した

```bash
rm -rf src/generated/prisma node_modules
npm install     # postinstallでprisma generateが自動実行されることを確認
npx next build --turbopack   # ビルド成功
npx tsc --noEmit              # エラーなし
npx vitest run                 # 40件パス
npm run lint                   # エラーなし(既存の警告1件のみ)
```

---

## 背景 — なぜこの変更が必要だったか

PR #43をsquash mergeでmainに取り込んだ直後、「mainにマージしたら自動でデプロイされる設定になっているか」という確認の過程で、Vercel CLI(`vercel ls`, `vercel inspect --logs`)を使って本番プロジェクトの状態を調べたところ、以下が判明しました。

1. `sharewallet`プロジェクトはGitHubリポジトリとGit連携済みで、mainへのpush(マージ)をトリガーに自動的に本番デプロイが走る設定になっている
2. マージ直後に走った自動デプロイ(Production・Preview両方)が両方とも**ビルドエラーで失敗**しており、本番URLが404を返す状態だった
3. ビルドログには`Module not found: Can't resolve '@/generated/prisma/client'`というエラーが出ていた

原因を調査したところ、`prisma/schema.prisma`でPrismaクライアントの出力先をデフォルトの`node_modules/@prisma/client`ではなくカスタムパス`src/generated/prisma`に指定しているにもかかわらず、`package.json`に`prisma generate`を自動実行する仕組み(`postinstall`スクリプト)がありませんでした。

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

ローカル開発環境では、過去に一度`npx prisma generate`を手動実行した際の生成物が`src/generated/prisma`にそのまま残っていた(かつ`.gitignore`でコミット対象外になっている)ため、誰も設定漏れに気付いていませんでした。CIの`.github/workflows/ci.yml`は`npx prisma generate`を明示的なステップとして実行しているため、CIでも今まで問題が表面化していませんでした。しかしVercelのビルド環境は毎回まっさらな状態から`npm install`のみでビルドするため、`postinstall`によるフック以外でPrismaクライアントを生成する手段がなく、importが解決できずビルドが失敗していました。

このプロジェクトがVercelのGit連携経由でビルドされたのはこれが初めてだったため、今回のPR #43マージまでこの設定漏れが顕在化していませんでした。

---

## 目的

### 主目的

1. Vercelの自動デプロイ(mainへのpush/マージ時)でビルドが成功し、本番サイトが正常にデプロイされる状態に戻す
2. 今後mainにマージするたびに同じ理由でビルドが失敗する事態を防ぐ

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| Prismaクライアントの出力先をデフォルトパスに戻す | `output`のカスタムパス自体はこの障害の直接原因ではなく(`postinstall`さえあれば動く)、変更範囲を広げる必要がないため |
| CIワークフローへの`next build`追加 | 今回の直接対応としては`postinstall`修正で十分。CIでのビルド確認導入は別途検討の余地があるため「今後の拡張候補」に留めた |
| Vercelプロジェクト設定(Build Command)側でprisma generateを追加 | `package.json`の`postinstall`で対応する方が、Vercel以外の環境(ローカル、他のホスティング)でも一貫して機能し、設定がコードとして残るため |

---

## 何を実装したか

### `package.json`

```diff
   "scripts": {
     "dev": "next dev --turbopack",
     "build": "next build --turbopack",
     "start": "next start",
     "lint": "eslint",
     "test": "vitest run",
-    "test:watch": "vitest"
+    "test:watch": "vitest",
+    "postinstall": "prisma generate"
   },
```

`npm install`(Vercelのビルドプロセスが実行するコマンド)完了後に自動的に`prisma generate`が実行されるようになり、`src/generated/prisma/client`が確実に生成されます。

### 動作確認の方法

ローカルでVercelのクリーンビルド環境を再現するため、生成済みファイルと依存パッケージを両方削除してから`npm install`をやり直しました。

```bash
rm -rf src/generated/prisma node_modules
npm install
# > sharewallet@0.1.0 postinstall
# > prisma generate
# ✔ Generated Prisma Client (7.4.0) to ./src/generated/prisma
```

この状態で`next build --turbopack`が成功することを確認し、修正前にVercel上で再現していたエラーと同じ条件で問題が解消していることを検証しました。

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `package.json` | 変更 | `postinstall`スクリプトで`prisma generate`を自動実行するよう追加 |
| `docs/27-Vercel本番ビルド失敗の修正postinstall-prisma-generate.md` | 新規 | 本ドキュメント |

---

## 動作確認

```bash
rm -rf src/generated/prisma node_modules
npm install        # postinstallでprisma generateが自動実行されることを確認
npx next build --turbopack   # ビルド成功
npx tsc --noEmit    # 型エラーなし
npx vitest run      # Test Files 5 passed / Tests 40 passed
npm run lint        # エラーなし(既存の警告1件のみ、変更ファイルとは無関係)
```

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 高 | CIワークフローに`next build`(またはそれに相当するビルド検証)を追加し、この種の「CIでは通るがVercelビルドでは落ちる」問題をマージ前に検出できるようにする | 未着手 |
| 中 | Vercelプロジェクトの過去のデプロイ履歴・ドメイン設定を棚卸しし、不要な古いプロジェクト(`sharewallet-frontend`等、調査時に存在が確認できなかった過去プロジェクト名の残骸)がないか確認する | 未着手 |
| 低 | 本番デプロイ失敗時にSlack等へ通知する仕組みの検討 | 未検討 |

---

## よくある質問

### Q. なぜCIでは今まで気づけなかったの？

`.github/workflows/ci.yml`は`npx prisma generate`を明示的なステップとして実行してから`npm test`/`npm run lint`を行う構成でした。そのためCI上ではPrismaクライアントが常に生成された状態でテストが走り、問題が再現しませんでした。一方Vercelのビルドは`npm install`のみを実行し、その後`next build`に進むため、`postinstall`のようなフックでprisma generateを仕込んでいない限りクライアントが生成されないまま`next build`が実行されていました。CIと実際のデプロイ環境で「何をどう生成しているか」の前提が揃っていなかったことが根本原因です。

### Q. この問題はいつから存在していた？

`prisma/schema.prisma`でカスタム出力パスを設定した時点から潜在していたはずですが、`sharewallet`プロジェクトがVercelのGit連携経由で実際にビルドされたのはPR #43のマージが初めてだったため、今回初めて顕在化しました。ローカル開発やCIでは生成済みファイルの有無に関する前提の違いにより問題が隠れていました。

### Q. 本番は今どうなっているの？

このPRのマージ後、mainへのpushをトリガーに自動デプロイが再度走り、今回の修正でビルドが成功する見込みです。マージ後は必ずVercelダッシュボードまたは`vercel ls`でデプロイステータスがReadyになっていることを確認してください。

---

## 関連ドキュメント

- [26. JWT_SECRET未設定時のfail-closed化まとめ](./26-JWT_SECRET未設定時のfail-closed化まとめ.md)
- `package.json` — `postinstall`スクリプトの実体
- `prisma/schema.prisma` — Prismaクライアントの出力先設定

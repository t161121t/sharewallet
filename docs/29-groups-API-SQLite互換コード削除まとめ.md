# 29. groups API SQLite互換コード削除まとめ

## これは何のドキュメント？

[GitHub issue #25](https://github.com/t161121t/sharewallet/issues/25) で行った、`groups` APIに残っていたSQLite時代の互換コード削除の作業記録です。

---

## まず結論（今回できたこと）

- `src/app/api/groups/route.ts`(POST)と`src/app/api/groups/[groupId]/route.ts`(PUT)から、到達不能になっていたSQLite互換フォールバックを削除した
- `prisma.group.create` / `prisma.group.update` をtry/catchのフォールバック無しの単純な形に戻した

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # 36件パス
```

---

## 背景 — なぜこの変更が必要だったか

`isUnknownIconUrlError`という関数が、Prismaのエラーメッセージに`"Unknown argument \`iconUrl\`"`や`"no such column: groups.icon_url"`が含まれるかを見て、`iconUrl`列が存在しない古いスキーマ(SQLite時代)でもグループ作成/更新が失敗しないようフォールバックする、という実装がPOST/PUT両方に存在していました。

すでにPostgreSQLへの移行が完了し、`prisma/schema.prisma`で`Group.iconUrl`(`icon_url`列)が定義され全マイグレーションが適用済みであるため、このフォールバックが実際に発火することはありません。到達しないコードパスが残っていると、読む人に「まだSQLite互換を気にする必要があるのか」という誤解を与え、無用な複雑性になります。

---

## 目的

### 主目的

1. 到達不能なフォールバック分岐を削除し、コードを実態(PostgreSQL前提)に合わせる
2. try/catchによる二重実装(同じcreate/updateを2箇所に書く)を解消する

### あえてやらなかったこと

| やらなかったこと | 理由 |
| --- | --- |
| 認証・認可エラーハンドリングの共通化 | issue #24として別スコープ化されている。今回はSQLite互換コードの削除のみに専念した |
| 入力検証の共通化(zod導入等) | issue #23として別スコープ化されている |

---

## 何を実装したか

### `src/app/api/groups/route.ts`(POST）

`isUnknownIconUrlError`関数と、それを使うtry/catchのフォールバック分岐を削除し、`prisma.group.create`を1回の呼び出しに戻した。

### `src/app/api/groups/[groupId]/route.ts`(PUT)

issueの対象ファイルには挙げられていなかったが、`grep`したところ全く同じ`isUnknownIconUrlError`関数と、`iconUrl`を取り除いて再試行するフォールバックがPUTハンドラにもコピペされていたため、同様に削除した。

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/app/api/groups/route.ts` | 変更 | `isUnknownIconUrlError`と、それを使うフォールバック分岐を削除 |
| `src/app/api/groups/[groupId]/route.ts` | 変更 | 同上(PUTハンドラ側) |
| `docs/29-groups-API-SQLite互換コード削除まとめ.md` | 新規 | 本ドキュメント |

**振る舞いの変更はありません。** 通常経路(`iconUrl`列が存在する現在のスキーマ)での動作は変更前後で同一です。

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 4 passed / Tests 36 passed
npx eslint <変更ファイル>  # 警告・エラーなし
```

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 | 状態 |
| --- | --- | --- |
| 中 | 認証・認可エラーハンドリングの共通化(issue #24) | 未着手 |
| 中 | zod等によるリクエストボディ検証の統一(issue #23) | 未着手 |

---

## よくある質問

### Q. フォールバックを消して、もし本当に古いDBスキーマのまま動かしていたらどうなる？

`iconUrl`列が存在しない環境ではPrismaがエラーを投げ、POST/PUTハンドラのcatch節で500エラーとして扱われます。ただし本番DBのマイグレーションは`prisma/migrations/20260313000000_init_postgresql`以降で`icon_url`列を含むベースラインに統一済みであることを確認しており、この状況は起こり得ません。

### Q. なぜissueに書かれていなかったPUTルートも直したの？

`grep -rn "isUnknownIconUrlError"`でリポジトリ全体を検索したところ、POSTと全く同じ関数・同じロジックがPUTハンドラにもコピペされていたため。issueの本質的な意図(到達不能なSQLite互換コードの除去)に沿うと判断し、対象を広げた。

---

## 関連ドキュメント

- [GitHub issue #25](https://github.com/t161121t/sharewallet/issues/25)
- `src/app/api/groups/route.ts` / `src/app/api/groups/[groupId]/route.ts`

# 31. BudgetDonutChart 削除まとめ

## これは何のドキュメント？

[GitHub issue #37](https://github.com/t161121t/sharewallet/issues/37) で指摘された、未使用のデッドコード `BudgetDonutChart` コンポーネントを削除した作業記録です。

---

## まず結論（今回できたこと）

- `src/components/ui/BudgetDonutChart.tsx` を削除した(どこからも使われていないことをgrepで確認済み)
- `docs/11-未実装機能一覧.md` の該当項目(#20)を「実データ化予定」から「対応済み(削除)」に更新した
- アプリケーションの実際の円グラフ表示(`src/app/expense/page.tsx`)は既に`ExpensePieChart`が実データで担っており、影響なし

```bash
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 4 passed / Tests 36 passed
npx eslint .        # BudgetDonutChart関連の問題なし
```

---

## 背景 — なぜ削除することにしたか

`BudgetDonutChart.tsx` はダミーデータ(`DUMMY_DATA`)を持つ円グラフコンポーネントで、`docs/11-未実装機能一覧.md`には当初「実データ化すべきバグ」として記録されていました。しかし実際にリポジトリ全体を検索すると、このコンポーネントをインポートしているページは1つもありませんでした。

```bash
grep -rn "BudgetDonutChart" src/ --include="*.ts" --include="*.tsx"
# → src/components/ui/BudgetDonutChart.tsx 内の定義自体のみヒット(使用箇所なし)
```

同じ役割を持つ`ExpensePieChart`は`src/app/expense/page.tsx`で実データ(`pieData`)を渡してすでに使われており、`BudgetDonutChart`は開発初期に作られたものの、後から`ExpensePieChart`に置き換えられて使われなくなった残骸だと判断しました。

---

## 選択肢の比較

issueでは「削除する」か「実データを繋いで使う」かの2択が提示されていました。

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. 削除する(採用)** | コンポーネントごと削除 | 重複した円グラフ実装を持たずに済む。保守対象が減る | 将来これとは違う見た目の円グラフが必要になった場合は改めて作る必要がある |
| B. 実データを繋いで使う | `DUMMY_DATA`を除去し、どこかのページから実データを渡して使う | コンポーネント資産を活かせる | `ExpensePieChart`と機能が重複し、なぜ2つの円グラフコンポーネントがあるのか分かりにくくなる。渡す先のページも新たに用意する必要があり、issueの本質的な問題(未使用コード)の解決にならない |

**Aを採用した理由**: `ExpensePieChart`という実データ版の円グラフが既に存在し実際に使われているため、`BudgetDonutChart`をわざわざ実データ化して両方を維持する理由がありません。「使う予定のないコードは消す」という方針が最もシンプルで、保守コストも増やさないと判断しました。

---

## 何を実装したか

1. `src/components/ui/BudgetDonutChart.tsx` を削除(バレルファイル`index.ts`等での再エクスポートは存在しなかったため、追加の参照修正は不要)
2. `docs/11-未実装機能一覧.md` の項目#20を取り消し線付きで「対応済み」に更新し、実際に取った対応(削除)を注記

---

## 変更ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `src/components/ui/BudgetDonutChart.tsx` | 削除 | 未使用のデッドコード |
| `docs/11-未実装機能一覧.md` | 変更 | 項目#20を対応済みに更新 |
| `docs/31-BudgetDonutChart削除まとめ.md` | 新規 | 本ドキュメント |

---

## 動作確認

```
npx tsc --noEmit   # 型エラーなし
npx vitest run     # Test Files 4 passed / Tests 36 passed
npx eslint .        # 既存の無関係な警告1件のみ(expense/page.tsxのimg要素、本対応とは無関係)
```

---

## 関連ドキュメント

- [GitHub issue #37](https://github.com/t161121t/sharewallet/issues/37)
- `docs/11-未実装機能一覧.md` — 項目#20の更新元
- `src/app/expense/page.tsx` — 実データ版の円グラフ`ExpensePieChart`の使用箇所

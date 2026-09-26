# 38. アプリ全体のiOS風デザイン刷新まとめ

## これは何のドキュメント？

[GitHub issue #39「アプリ全体のデザインをiOS風に刷新する」](https://github.com/t161121t/sharewallet/issues/39) で行った、UIライブラリ導入と画面デザイン刷新の作業記録です。issue本文にはすでに「共通トークン→ナビゲーション→共通コンポーネント→各画面適用」という進め方の提案が書かれており、今回はその方針に沿って実装しました。過去の`docs/`とは異なり認証・DB周りの変更ではなくフロントエンドの見た目・UIライブラリ選定が中心のため、選定の経緯を厚めに書いています。

---

## まず結論（今回できたこと）

- Tailwind CSS製のiOS/Material向けUIコンポーネント集 **[Konsta UI](https://github.com/konstaui/konsta)** を導入した
- 既存のブランドカラー(ゴールド)をKonstaの `--color-brand-primary` に設定し、Konstaの全コンポーネント(ボタン・ナビバー・タブバー等)がそのままブランドカラーで統一されるようにした
- `Header`(iOSのNavbar、Large Title・戻るchevron対応)と`BottomNav`(iOSタブバー、アクティブ時に塗りつぶしアイコン)を全面刷新し、全画面から使えるようにした
- `PrimaryButton`をKonstaの`Button`ベースに、`TextInput`を枠線なしの塗りつぶしスタイルに刷新した
- 新規共通コンポーネントとして`Card`・`ListRow`を追加した
- ホーム・支出入力・支出履歴・グループ作成/設定/精算・プロフィールの各画面に適用した(タブ切り替えをKonstaの`Segmented`に、支出編集モーダルをKonstaの`Sheet`(下からせり上がるシート)に置き換えるなど)
- ログイン/新規登録/招待受諾画面は、ブランドロゴを主役にした既存の演出を活かすため、あえてNavbarは付けずTextInput/PrimaryButtonの見た目刷新のみ適用した

```bash
npx tsc --noEmit        # 型エラーなし(既存の未コミットの別作業由来のファイルを除く)
npx vitest run          # Test Files 11 passed / Tests 98 passed
npx eslint <対象ファイル> # エラーなし(画像最適化の警告のみ、既存・対象外)
npx next build --turbopack # ビルド成功(検証時のみ、他作業由来の未コミットファイルを一時退避して確認。詳細は「動作確認」参照)
```

---

## 背景 — なぜこの変更が必要だったか

これまでのUIは暖色(ゴールド)基調のオリジナルデザインで機能的には問題なかったものの、「iOS標準アプリ(設定・カレンダー・ウォレット等)のような使いやすさ・見た目」を目指したいという要望がありました。就活用の個人プロダクトという性質上、見た目の完成度・再現度も重要な評価軸になります。

issue本文の時点で「共通コンポーネント・トークンを先に作り直す→2〜3画面で適用イメージを確認→残り画面へ横展開」という段階的な進め方が提案されていましたが、今回は「手戻りは気にしなくていい」という方針のもと、共通コンポーネントの整備と対象画面全体への適用を一度に行いました。

---

## 選択肢の比較

iOS風の見た目を実現する方法として、大きく3つの方向性を検討しました。

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| **A. Konsta UI導入(採用)** | Tailwind CSS製、iOS/Materialテーマのコンポーネント集を導入 | Large Title付きNavbar・タブバー・Sheet等、本物に近いiOS部品が最初から揃っている。Tailwind v4・React 19に対応済みで、既存のCSS変数ベースのトークン設計ともそのまま馴染む。ルーティングを乗っ取らないので既存のNext.js App Routerの構成を維持できる | 外部ライブラリのコンポーネントAPI(props名など)を新たに覚える必要がある |
| B. Ionic React / Framework7 | ネイティブアプリ的な機能一式(ルーター・ライフサイクル管理等)を提供するアプリフレームワーク | iOS/Androidの自動テーマ切替が強力 | 独自のルーター・アプリシェルが前提になっており、Next.js App Routerと二重管理になる。Web単体アプリには過剰(Capacitorありきの設計) |
| C. 自前実装(Tailwindの素のユーティリティのみ) | 既存のコンポーネントを手動でCSSから作り直す | 依存ライブラリが増えない。既存コードとの差分が小さい | Large Titleのスクロール連動収縮や、iOSのタップ時ハイライトなど、細部の再現に時間がかかる。同じ完成度に到達するまでの工数がKonsta UI採用より大きい |

**Aを採用した理由**: 「手戻りを気にしない」という方針のもとでは、時間をかけて自前実装するより、実績のある専用ライブラリを使って浮いた時間を画面数・完成度に回す方が、今回の目的(portfolio的な完成度)に合っていると判断しました。またKonsta UIはTailwind CSSベースで、CSS変数(`@theme`)によるテーマ上書きが可能なため、既存の設計を大きく壊さずに導入できる点も決め手になりました。

---

## 目的

**主目的**: アプリ全体の見た目をiOS標準アプリ的な質感(Large Title・タブバー・Grouped List・塗りつぶしボタン)に統一し、ブランドカラー(ゴールド)は維持したまま完成度を上げること。

| あえてやらなかったこと | 理由 |
| --- | --- |
| SF Symbolsアイコンの使用 | Appleの公式アイコンでありライセンス上Web/他OSでの使用が認められていないため。代わりに`lucide-react`のアウトライン系アイコンを使用した |
| ログイン・新規登録・招待受諾画面へのNavbar追加 | これらの画面はブランドロゴ(コインアイコン・スクリプト体ロゴ)を主役にした演出がすでにあり、Navbarを重ねると二重の見出しになってしまうため、TextInput/PrimaryButtonの刷新のみに留めた |
| 全カード内部の色付きデータ可視化(カテゴリ別・グループ別の内訳表示など)の再設計 | issueの主眼は「iOSらしいUI部品・ナビゲーションへの統一」であり、これらは既存のブランド色を活かした独自の可視化のため、外枠(角丸・区切り線)のトークンのみ統一し、中身の配色ロジックは変更しなかった |
| Large Titleのスクロール収縮アニメーションの完全なチューニング | Konstaの実装は「Navbarの親要素がスクロールコンテナである」ことを前提にしており、`ScreenContainer`をスクロールコンテナ化(`h-dvh overflow-y-auto`)することで概ね動作するが、画面ごとの微調整までは行っていない |

---

## 何を実装したか

### 1. 依存パッケージの追加

- `konsta`(Tailwind CSS製のiOS/Material UIコンポーネント集)
- `lucide-react`(アウトラインアイコン。SF Symbolsの代替として使用)

### 2. `src/app/globals.css` — Konstaテーマの読み込みとブランドカラーの上書き

```css
@import "tailwindcss";
@import "konsta/react/theme.css";

:root {
  /* ...既存のゴールド系トークン... */
  /* iOSのカード・シート角丸(Konstaの大きめカード相当) */
  --radius-card: 1.25rem;
  /* iOSのhairlineセパレーター色 */
  --color-separator: rgba(60, 60, 67, 0.29);
}

/* Konstaのブランドカラーをゴールドに差し替える。ここから ios-primary / md-light-primary
   等の派生色がすべて自動生成される(node_modules/konsta/plugin-colors.js参照) */
@theme {
  --color-brand-primary: #c9a227;
}
```

ダークモード用に`--color-separator`の値も`@media (prefers-color-scheme: dark)`ブロック内で上書きしている。

### 3. `src/components/layout/KonstaProvider.tsx`(新規) — Client Component境界の切り出し

Konstaの`<App>`はReact Contextを内部で使うため、Server Componentであるルートレイアウト(`layout.tsx`)から直接importするとビルドエラーになる。そのため`"use client"`付きの薄いラッパーに切り出した。

```tsx
"use client";
import type { ReactNode } from "react";
import { App } from "konsta/react";

export default function KonstaProvider({ children }: { children: ReactNode }) {
  return (
    <App theme="ios" safeAreas>
      {children}
    </App>
  );
}
```

`src/app/layout.tsx`ではこれを`<body>`直下でchildrenをラップするだけにしている。

### 4. `src/components/layout/ThemeSync.tsx`(新規) — ダークモード判定方式の橋渡し

Konsta UIの`dark:`バリアントは`prefers-color-scheme`メディアクエリではなく、`.dark`クラスの有無で切り替わる仕様(`node_modules/konsta/styles/base.css`の`@custom-variant dark (&:where(.dark, .dark *))`)。この宣言はTailwindの`dark`バリアント自体をグローバルに上書きするため、既存コンポーネントの`dark:`クラスも巻き込まれて挙動が変わってしまう。そこでOSのダークモード設定を`<html>`の`.dark`クラスに同期するコンポーネントを追加し、両者の基準を揃えた。

```tsx
"use client";
import { useEffect } from "react";

export default function ThemeSync() {
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => {
      document.documentElement.classList.toggle("dark", matches);
    };
    apply(mql.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return null;
}
```

### 5. `src/components/layout/Header.tsx` — iOSのNavbar化

従来は使われていなかった(grepで参照ゼロだった)コンポーネントを、Konstaの`Navbar`/`NavbarBackLink`を使ったものに書き直した。

```tsx
export default function Header({ title, large = false, showBackButton = false, right }: HeaderProps) {
  const router = useRouter();
  return (
    <Navbar
      title={title}
      large={large}
      left={showBackButton ? <NavbarBackLink onClick={() => router.back()} /> : undefined}
      right={right}
    />
  );
}
```

`large`はタブルート画面(ホーム・入力・詳細・マイページ)でLarge Titleにする際にtrue、プッシュ遷移する下層画面(グループ作成・設定・精算)では`showBackButton`をtrueにして戻るchevronを出す、という使い分けにした。

### 6. `src/components/layout/BottomNav.tsx` — iOSタブバー化

Konstaの`Tabbar`/`TabbarLink`に置き換え、アイコンは`lucide-react`のアウトラインアイコンを使用。アクティブなタブは`fill="currentColor"`・太めの`strokeWidth`にすることで、SF Symbolsのアウトライン/塗りつぶし切り替えに近い見た目にした。

Next.jsの`<Link>`をKonstaの`component`propに渡す際、TypeScript上`href`は`TabbarLink`自体のpropsに存在しないため(`linkProps`経由でしか渡せない)、`linkProps={{ href: item.href }}`という形で渡している。

### 7. `src/components/layout/ScreenContainer.tsx` — headerスロットの追加とスクロールコンテナ化

```tsx
export default function ScreenContainer({ children, header }: ScreenContainerProps) {
  return (
    <main className="h-dvh w-full overflow-y-auto bg-[#faf8f5] dark:bg-[#111110] flex flex-col">
      {header}
      <div className="flex-1 flex flex-col w-full max-w-lg mx-auto px-6 py-8">
        {children}
      </div>
    </main>
  );
}
```

Konstaの`Navbar`は`sticky top-0`で実装されており、Large Titleのスクロール収縮はNavbarの親要素(またはscrollElで明示的に指定した要素)がスクロールする前提で動く。従来の`min-h-dvh`(ページ全体がbody基準でスクロール)から`h-dvh overflow-y-auto`(mainタグ自体がスクロールコンテナ)に変更することで、この前提を満たすようにした。

### 8. `src/components/ui/PrimaryButton.tsx` / `TextInput.tsx` — 見た目の刷新(外部API互換)

- `PrimaryButton`: 内部実装をKonstaの`<Button large rounded>`に置き換え。従来のグラデーション+シマーアニメーションは廃止し、iOSのフィルドボタン(単色・カプセル型)にした。propsの型(`ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }`)は変えていないため、呼び出し側の変更は不要
- `TextInput`: 枠線ありの白背景から、枠線なしのグレー塗りつぶし背景(`bg-black/[0.04] dark:bg-white/10`)に変更。propsのシグネチャ(label/value/onChange等)は変更なし

### 9. `src/components/ui/Card.tsx` / `ListRow.tsx`(新規)

- `Card`: Konstaの`Card`を`--radius-card`トークンでラップした薄いラッパー。`contentWrapPadding`で内側パディングを調整可能にしている
- `ListRow`: Konstaの`ListItem`を薄くラップし、アイコン+タイトル+chevronの行を簡潔に書けるようにした(`<List>`の子として使用)

### 10. 各画面への適用

| 画面 | 適用内容 |
| --- | --- |
| `home/page.tsx` | ログイン/新規登録リンクをKonstaの`Button`(href直指定)に置き換え |
| `dashboard/page.tsx` | `Header`(Large Title)追加、3択タブ切り替えをKonstaの`Segmented`/`SegmentedButton`に置き換え、カード類の枠線・角丸をトークン化 |
| `expense/page.tsx` | `Header`追加、ブランド名の重複表示を削除、フォーム系input群を塗りつぶしスタイルに統一 |
| `expense/history/page.tsx` | `Header`追加、精算確認導線をKonstaの`Button outline`に、支出編集モーダルをKonstaの`Sheet`(下からせり上がるシート)に置き換え |
| `groups/new/page.tsx` | `Header showBackButton`追加、アイコン選択ボタンをKonstaの`Button`に |
| `groups/[groupId]/settings/page.tsx` | `Header showBackButton`追加、招待リンク一覧・メンバー一覧をKonstaの`List`/`ListItem`に置き換え |
| `groups/[groupId]/settlement/page.tsx` | `Header showBackButton`追加、ブランド名の重複表示を削除 |
| `profile/page.tsx` | `Header`(Large Title)追加、4つのセクションをすべて`Card`に置き換え、ログアウトボタンをKonstaの`Button outline`に |
| `login` / `register` / `invite/[token]` | Navbarは追加せず、TextInput/PrimaryButton刷新の恩恵のみ受ける形に据え置き |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
| --- | --- |
| `package.json` / `package-lock.json` | `konsta`・`lucide-react`を追加 |
| `src/app/globals.css` | Konstaテーマの読み込み、ブランドカラー・角丸・セパレーターの上書き |
| `src/app/layout.tsx` | `KonstaProvider`・`ThemeSync`の組み込み |
| `src/components/layout/KonstaProvider.tsx` | 新規。Konsta `<App>`のClient Componentラッパー |
| `src/components/layout/ThemeSync.tsx` | 新規。OSのダークモード設定を`.dark`クラスに同期 |
| `src/components/layout/Header.tsx` | Konstaの`Navbar`ベースに全面書き換え |
| `src/components/layout/BottomNav.tsx` | Konstaの`Tabbar`ベースに全面書き換え |
| `src/components/layout/ScreenContainer.tsx` | `header`スロット追加、スクロールコンテナ化 |
| `src/components/ui/PrimaryButton.tsx` | Konstaの`Button`ベースに刷新(外部API互換) |
| `src/components/ui/TextInput.tsx` | 塗りつぶしスタイルに刷新(外部API互換) |
| `src/components/ui/Card.tsx` | 新規。Konstaの`Card`ラッパー |
| `src/components/ui/ListRow.tsx` | 新規。Konstaの`ListItem`ラッパー |
| `src/app/home/page.tsx` | CTAボタンをKonsta `Button`に |
| `src/app/dashboard/page.tsx` | `Header`追加、`Segmented`導入、トークン化 |
| `src/app/expense/page.tsx` | `Header`追加、フォーム類を塗りつぶしスタイルに統一 |
| `src/app/expense/history/page.tsx` | `Header`追加、編集モーダルを`Sheet`化 |
| `src/app/groups/new/page.tsx` | `Header`追加、`Card`/`Button`導入 |
| `src/app/groups/[groupId]/settings/page.tsx` | `Header`追加、`Card`/`List`/`ListItem`導入 |
| `src/app/groups/[groupId]/settlement/page.tsx` | `Header`追加、トークン化 |
| `src/app/profile/page.tsx` | `Header`追加、`Card`導入、ログアウトボタン刷新 |

---

## 動作確認

```bash
npx tsc --noEmit
# → 型エラーなし(src/app/analysis等、今回のタスクと無関係な未コミットの
#   別作業由来ファイルのエラーのみ残存。除外して確認)

npx eslint <対象ファイル群>
# → エラーなし。画像最適化の警告(no-img-element)のみ、既存かつ対象外の箇所

npx vitest run
# → Test Files 11 passed / Tests 98 passed

npm run dev（開発サーバー）で以下のページの応答・レンダリングを確認:
# /login /register /home /dashboard /expense /expense/history /profile /groups/new → 全て200
# curlでレスポンスHTMLに k-navbar / k-tabbar / k-button 等のKonsta由来クラスが
# 出力されていることを確認(Navbar・Tabbar・Buttonが実際にレンダリングされている証拠)

npx next build --turbopack
# → 通常実行するとリポジトリ内に残っている今回とは無関係な未コミットの
#   別作業(カレンダー中心ホーム機能、docs/37関連)のファイル群でビルドが失敗する。
#   これらを一時的に退避(mv)し、ビルド成功を確認したうえで元の場所に復元した。
#   今回のタスクの変更それ自体はビルドを妨げていないことを確認済み。
```

---

## 今後の拡張候補（優先度順）

| 優先度 | 内容 |
| --- | --- |
| 高 | Large Titleのスクロール収縮アニメーションを画面ごとに検証し、`scrollEl`の明示指定が必要な箇所を洗い出す |
| 中 | ダッシュボードのグループ別・カテゴリ別内訳カードなど、データ可視化部分もiOSのGrouped List的な行表現に統一する |
| 中 | 招待受諾画面(`invite/[token]`)にも軽量なNavbar(タイトルのみ、戻るボタンなし)を検討する |
| 低 | Konsta UIの`ActionSheet`・`Popover`など、まだ使っていないコンポーネントを他の確認ダイアログ(削除確認等)にも展開する |

---

## よくある質問

**Q. Konsta UIを導入すると、既存の`dark:`クラスの挙動は変わりますか？**
A. はい、変わります。Konsta UIは`dark:`バリアントの判定基準を`prefers-color-scheme`メディアクエリから`.dark`クラスの有無に上書きするため(`ThemeSync`参照)、既存コンポーネントの`dark:`クラスも巻き込まれます。今回`ThemeSync`でOS設定と`.dark`クラスを同期させることで、見た目の挙動自体は変えずに済んでいます。

**Q. なぜ`layout.tsx`に直接`<App>`を書かず、`KonstaProvider`という別ファイルに切り出したのですか？**
A. Konstaの`<App>`は内部でReact Contextを使っており、Client Componentでしか使えません。`layout.tsx`はNext.jsの規約上Server Component(`next/font`を使うため)なので、直接importすると`createContext only works in Client Components`というビルドエラーになります。`"use client"`を付けた薄いラッパーに切り出すことで解決しました。

**Q. `next build`がエラーになるのですが、今回の変更のせいですか？**
A. いいえ。リポジトリ内には今回のタスクとは別の、カレンダー中心ホーム機能の未コミット作業(`src/app/analysis/`等、docs/37関連)が残っており、これが`@/types`の型不足などで元々ビルドを通らない状態でした。動作確認時にはこれらを一時退避してビルドが通ることを確認し、元に戻しています。今回の変更ファイル自体が原因ではありません。

**Q. `PrimaryButton`や`TextInput`の使い方（呼び出し側のprops）は変わりましたか？**
A. 変わっていません。外部から見えるprops(`label`/`value`/`onChange`/`loading`等)は維持したまま、内部実装だけをKonsta UIベースに差し替えているため、呼び出し側のコードは無修正で恩恵を受けられます。

---

## 関連ドキュメント

- [GitHub issue #39](https://github.com/t161121t/sharewallet/issues/39)
- 主要ファイル: `src/components/layout/Header.tsx`, `src/components/layout/BottomNav.tsx`, `src/components/layout/KonstaProvider.tsx`, `src/components/layout/ThemeSync.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/ListRow.tsx`, `src/app/globals.css`

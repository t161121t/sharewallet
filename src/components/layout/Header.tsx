"use client";

import { useRouter } from "next/navigation";
import { Navbar, NavbarBackLink } from "konsta/react";
import type { ReactNode } from "react";

type HeaderProps = {
  /** ナビゲーションバーのタイトル */
  title: string;
  /**
   * スクロールで縮む大きなタイトル(iOSのLarge Title)にするか。
   * トップレベルのタブ画面ではtrue、詳細・設定などの下層画面ではfalseにする。
   */
  large?: boolean;
  /** trueの場合、戻るchevronを表示する。遷移先は既定でrouter.back() */
  showBackButton?: boolean;
  /**
   * 戻るchevronの遷移先を固定のパスにしたい場合に指定する(例: 直リンクや
   * 履歴が無い状態で開かれても必ず特定の画面に戻したい場合)。
   * 省略時はrouter.back()(ブラウザ履歴を1つ戻る)を使う。
   */
  backHref?: string;
  /** ナビゲーションバー右側に置くアクション(保存ボタンなど) */
  right?: ReactNode;
};

export default function Header({
  title,
  large = false,
  showBackButton = false,
  backHref,
  right,
}: HeaderProps) {
  const router = useRouter();

  return (
    <Navbar
      title={title}
      large={large}
      left={
        showBackButton ? (
          <NavbarBackLink onClick={() => (backHref ? router.push(backHref) : router.back())} />
        ) : undefined
      }
      right={right}
    />
  );
}

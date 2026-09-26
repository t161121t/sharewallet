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
  /** trueの場合、戻るchevronを表示してrouter.back()を呼ぶ */
  showBackButton?: boolean;
  /** ナビゲーションバー右側に置くアクション(保存ボタンなど) */
  right?: ReactNode;
};

export default function Header({
  title,
  large = false,
  showBackButton = false,
  right,
}: HeaderProps) {
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

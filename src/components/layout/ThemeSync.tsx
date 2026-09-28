"use client";

import { useEffect } from "react";

/**
 * Konsta UIのdark:バリアントは `.dark` クラスの有無で切り替わる(prefers-color-schemeの
 * メディアクエリではない)。既存コンポーネントのdark:クラスも同じ基準で揃えるため、
 * OSのダークモード設定を <html> の.darkクラスに同期する。
 */
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

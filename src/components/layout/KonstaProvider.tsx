"use client";

import type { ReactNode } from "react";
import { App } from "konsta/react";

/**
 * konsta/react の <App> は内部でReact Contextを使うため、Client Component配下でしか
 * 使えない。ルートレイアウト(Server Component)から直接importするとビルドエラーになるため、
 * このラッパーに切り出す。
 */
export default function KonstaProvider({ children }: { children: ReactNode }) {
  return (
    <App theme="ios" safeAreas>
      {children}
    </App>
  );
}

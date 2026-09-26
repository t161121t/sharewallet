import type { ReactNode } from "react";

type ScreenContainerProps = {
  children: ReactNode;
  /**
   * Navbar(iOSのLarge Title等)を画面上部に全幅で表示する。
   * このmain自体をスクロールコンテナにすることで、Navbarのスクロール連動の
   * タイトル縮小(large/mediumモード)が正しく機能する。
   */
  header?: ReactNode;
};

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

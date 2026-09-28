"use client";

import Link from "next/link";
import { Button } from "konsta/react";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import Logo from "@/components/ui/Logo";
import CoinIcon from "@/components/ui/CoinIcon";

export default function HomePage() {
  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1">
        <div className="flex-1 flex items-center justify-center w-full">
          <Logo size={140} showScriptText={true} />
        </div>

        <div className="flex flex-col gap-5 w-full pb-4">
          <Button component={Link} large rounded href="/login" className="h-14 text-lg" aria-label="ログイン画面へ">
            ログイン
          </Button>
          <Button
            component={Link}
            large
            rounded
            tonal
            href="/register"
            className="h-14 text-lg"
            aria-label="新規登録画面へ"
          >
            新規登録
          </Button>
        </div>

        <footer className="py-4 flex justify-center">
          <CoinIcon size="md" />
        </footer>
      </PageTransition>
    </ScreenContainer>
  );
}

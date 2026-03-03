"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import Logo from "@/components/ui/Logo";
import DashboardSummary from "@/components/ui/DashboardSummary";
import type { DashboardSummaryResponse } from "@/types";
import {
  isAuthenticated,
  getDashboardSummary,
} from "@/lib/apiClient";

export default function DashboardPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setIsReady(true);

    // 今月サマリーを取得（失敗時はサマリーのみ非表示）
    setIsSummaryLoading(true);
    getDashboardSummary("current-month")
      .then((summaryData) => {
        setSummary(summaryData);
      })
      .catch(() => {
        setSummary(null);
      })
      .finally(() => {
        setIsSummaryLoading(false);
      });
  }, [router]);

  if (!isReady) return <RouteLoading text="ホームを読み込み中..." withBottomNav />;

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1 pb-20">
        <div className="pt-2 pb-6 w-full">
          <div className="relative mx-auto w-fit px-7 py-4 rounded-3xl bg-gradient-to-br from-[#fff4d6] via-[#f8efe0] to-[#e9f4ff] dark:from-[#3a321f] dark:via-[#2b2926] dark:to-[#1f2a35] border border-[#ece2cc] dark:border-[#403a31]">
            <span className="absolute -top-3 -left-2 w-8 h-8 rounded-full bg-[#ffd76b]/70 dark:bg-[#7a6628]/60" />
            <span className="absolute -bottom-3 -right-2 w-9 h-9 rounded-full bg-[#8ac4ff]/60 dark:bg-[#2d4d6f]/60" />
            <span className="absolute top-2 -right-4 w-6 h-6 rounded-full bg-[#f7a8b8]/50 dark:bg-[#6a3b47]/60" />
            <Logo size={100} showScriptText={true} />
          </div>
        </div>

        {isSummaryLoading ? (
          <section className="w-full rounded-2xl border border-[#ece6dc] dark:border-[#3a3733] bg-white/80 dark:bg-[#1f1f1f]/70 p-4 mb-5 animate-pulse">
            <div className="h-4 w-48 rounded bg-[#ece6dc] dark:bg-[#3a3733]" />
            <div className="mt-3 h-16 rounded-xl bg-[#f2ece2] dark:bg-[#2a2926]" />
            <div className="mt-4 h-32 rounded-xl bg-[#f2ece2] dark:bg-[#2a2926]" />
            <div className="mt-3 h-9 rounded-xl bg-[#f2ece2] dark:bg-[#2a2926]" />
            <div className="mt-2 h-9 rounded-xl bg-[#f2ece2] dark:bg-[#2a2926]" />
          </section>
        ) : (
          summary && <DashboardSummary summary={summary} />
        )}

      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

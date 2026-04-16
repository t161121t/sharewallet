"use client";

import { motion } from "framer-motion";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";

type RouteLoadingProps = {
  text?: string;
  withBottomNav?: boolean;
};

export default function RouteLoading({
  text = "読み込み中...",
  withBottomNav = false,
}: RouteLoadingProps) {
  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center justify-center w-full flex-1 pb-20 gap-4">
        {/* コインスピナー */}
        <div className="relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
          {/* 外側リング */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              borderTopColor: "#c9a227",
              borderRightColor: "rgba(201, 162, 39, 0.3)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
          {/* 内側リング（逆回転） */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: 6,
              border: "1.5px solid transparent",
              borderBottomColor: "#e8c547",
              borderLeftColor: "rgba(232, 197, 71, 0.25)",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          />
          {/* 中央コイン */}
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              background: "radial-gradient(circle at 38% 32%, #FFE87A, #D49018)",
              boxShadow: "0 2px 6px rgba(201, 162, 39, 0.35)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#7A4400",
                lineHeight: 1,
              }}
            >
              ¥
            </span>
          </div>
        </div>

        <p className="text-sm text-[#7a756d] dark:text-[#9e9a93]">{text}</p>
      </PageTransition>
      {withBottomNav && <BottomNav />}
    </ScreenContainer>
  );
}

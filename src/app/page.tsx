"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ShareWalletLogo from "@/components/ui/ShareWalletLogo";

// フローティングパーティクルの定義
const PARTICLES = [
  { x: 12,  y: 18,  size: 5,   delay: 0,    dur: 3.2 },
  { x: 88,  y: 14,  size: 4,   delay: 0.5,  dur: 2.8 },
  { x: 8,   y: 62,  size: 3,   delay: 0.9,  dur: 3.6 },
  { x: 92,  y: 58,  size: 3.5, delay: 0.2,  dur: 3.0 },
  { x: 50,  y: 6,   size: 2.5, delay: 0.7,  dur: 2.5 },
  { x: 22,  y: 84,  size: 3,   delay: 1.1,  dur: 3.4 },
  { x: 78,  y: 80,  size: 2.5, delay: 0.35, dur: 3.1 },
  { x: 65,  y: 90,  size: 2,   delay: 0.8,  dur: 2.9 },
  { x: 35,  y: 88,  size: 2,   delay: 1.3,  dur: 3.3 },
];

export default function SplashPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const shimmerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outTimer = setTimeout(() => setVisible(false), 2300);
    const navTimer = setTimeout(() => router.push("/home"), 2900);
    return () => {
      clearTimeout(outTimer);
      clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <div
      className="min-h-dvh w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #2e1f00 0%, #170f00 45%, #060400 100%)",
      }}
    >
      {/* 放射状ゴールドグロー */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 44%, rgba(212, 144, 24, 0.18) 0%, transparent 62%)",
        }}
      />

      {/* 床面リフレクション */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(212, 144, 24, 0.06) 0%, transparent 100%)",
        }}
      />

      {/* フローティングパーティクル */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: "#F5C538",
          }}
          animate={{
            opacity: [0, 0.85, 0],
            y: [0, -18, -36],
            scale: [0.4, 1.1, 0.4],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <AnimatePresence>
        {visible && (
          <motion.div
            className="flex flex-col items-center gap-10 relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.88, y: -16 }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
          >
            {/* ロゴエリア */}
            <div className="relative flex items-center justify-center">
              {/* 外側パルスグロー */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 320,
                  height: 320,
                  background:
                    "radial-gradient(circle, rgba(245, 197, 56, 0.2) 0%, transparent 70%)",
                  filter: "blur(18px)",
                }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* リングアクセント */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 268,
                  height: 268,
                  border: "1px solid rgba(245, 197, 56, 0.25)",
                  boxShadow: "0 0 24px rgba(245, 197, 56, 0.12)",
                }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              />

              {/* ロゴコンテナ */}
              <motion.div
                className="relative rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  width: 248,
                  height: 248,
                  background: "rgba(255, 220, 80, 0.055)",
                  border: "1px solid rgba(245, 197, 56, 0.18)",
                  backdropFilter: "blur(16px)",
                  boxShadow:
                    "0 0 48px rgba(212, 144, 24, 0.22), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
                }}
                initial={{ scale: 0.45, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: 0.75,
                  ease: [0.34, 1.56, 0.64, 1], // spring-like cubic-bezier
                }}
              >
                {/* シマースウィープ */}
                <motion.div
                  ref={shimmerRef}
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 10 }}
                  initial={{ x: "-130%" }}
                  animate={{ x: "230%" }}
                  transition={{
                    delay: 0.85,
                    duration: 0.9,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                >
                  <div
                    style={{
                      width: "55%",
                      height: "100%",
                      background:
                        "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.13) 50%, transparent 80%)",
                      transform: "skewX(-18deg)",
                    }}
                  />
                </motion.div>

                <ShareWalletLogo size={196} showText={false} />
              </motion.div>
            </div>

            {/* タイトル & サブタイトル */}
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.65, ease: "easeOut" }}
            >
              <p
                className="text-5xl"
                style={{
                  fontFamily: "var(--font-dancing-script), cursive",
                  background:
                    "linear-gradient(140deg, #FFE87A 0%, #F5C538 35%, #D49018 70%, #C07200 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 2px 10px rgba(212, 144, 24, 0.45))",
                }}
              >
                Share Wallet
              </p>

              <motion.p
                className="text-xs tracking-[0.2em]"
                style={{ color: "rgba(245, 197, 56, 0.5)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.7 }}
              >
                割り勘を、もっとスマートに
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import GroupAvatar from "@/components/ui/GroupAvatar";
import type { Group, SettlementResult } from "@/types";
import { getGroup, getSettlement, isAuthenticated } from "@/lib/apiClient";

function UserAvatar({
  name,
  color,
  avatarUrl,
  size = 40,
}: {
  name: string;
  color: string;
  avatarUrl?: string;
  size?: number;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} width={size} height={size} unoptimized className="object-cover" />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
          {name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

export default function SettlementPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [isReady, setIsReady] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    Promise.all([getGroup(groupId), getSettlement(groupId)])
      .then(([g, s]) => {
        setGroup(g);
        setSettlement(s);
        setIsReady(true);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [groupId, router]);

  if (!isReady || !group || !settlement) {
    return <RouteLoading text="精算を計算中..." withBottomNav />;
  }

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col w-full flex-1 pb-20">
        <p
          className="text-4xl text-[#2d2a26] dark:text-[#eae7e1] pb-4 text-center"
          style={{ fontFamily: "var(--font-dancing-script), cursive" }}
        >
          Share Wallet
        </p>

        <div className="flex items-center gap-2 mb-4">
          <GroupAvatar name={group.name} color={group.color} iconUrl={group.iconUrl} size={32} className="rounded-full" />
          <span className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1]">
            {group.name}
          </span>
        </div>

        {/* サマリーカード */}
        <div
          className="w-full rounded-2xl p-5 text-white shadow-lg mb-6"
          style={{
            background: "linear-gradient(135deg, #d4a320 0%, #e8c547 50%, #c9a227 100%)",
          }}
        >
          <p className="text-sm font-medium opacity-90">全期間の合計支出</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">
            ¥{settlement.totalExpenseAmount.toLocaleString()}
          </p>
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-white/30">
            <div>
              <p className="text-xs opacity-80">件数</p>
              <p className="text-lg font-bold tabular-nums">{settlement.expenseCount}件</p>
            </div>
            <div>
              <p className="text-xs opacity-80">メンバー</p>
              <p className="text-lg font-bold tabular-nums">{group.members.length}人</p>
            </div>
          </div>
        </div>

        {/* 精算トランザクション */}
        <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-3">
          精算方法
        </h2>

        {settlement.transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-green-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-[#2d2a26] dark:text-[#eae7e1]">精算は不要です</p>
            <p className="text-sm text-[#9e9a93] mt-1">全員の支払いが均等です</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {settlement.transactions.map((tx, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#1c1b19] shadow-sm border border-[#f0ece6] dark:border-[#262522]"
              >
                <UserAvatar name={tx.fromUserName} color={tx.fromUserColor} avatarUrl={tx.fromUserAvatarUrl} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1] truncate">
                    {tx.fromUserName}
                  </p>
                  <p className="text-xs text-[#9e9a93]">支払う</p>
                </div>
                <div className="flex flex-col items-center px-2">
                  <p className="text-base font-bold text-[#c9a227] tabular-nums">
                    ¥{tx.amount.toLocaleString()}
                  </p>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-[#c9a227] mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1] truncate">
                    {tx.toUserName}
                  </p>
                  <p className="text-xs text-[#9e9a93]">受け取る</p>
                </div>
                <UserAvatar name={tx.toUserName} color={tx.toUserColor} avatarUrl={tx.toUserAvatarUrl} size={40} />
              </div>
            ))}
          </div>
        )}

        {/* 残高一覧 */}
        <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-3">
          残高内訳
        </h2>

        <div className="flex flex-col gap-2">
          {settlement.memberBalances.map((mb) => (
            <div
              key={mb.userId}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1c1b19] border border-[#f0ece6] dark:border-[#262522]"
            >
              <UserAvatar name={mb.userName} color={mb.userColor} avatarUrl={mb.userAvatarUrl} size={36} />
              <span className="flex-1 text-sm font-medium text-[#2d2a26] dark:text-[#eae7e1] truncate">
                {mb.userName}
              </span>
              <span
                className={[
                  "text-sm font-bold tabular-nums",
                  mb.balance > 0
                    ? "text-green-500"
                    : mb.balance < 0
                    ? "text-red-500"
                    : "text-[#9e9a93]",
                ].join(" ")}
              >
                {mb.balance > 0 ? "+" : ""}
                ¥{mb.balance.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import Logo from "@/components/ui/Logo";
import CategoryIcon from "@/components/icons/CategoryIcon";
import GroupAvatar from "@/components/ui/GroupAvatar";
import type { CategoryName, DashboardSummary, Group } from "@/types";

import {
  isAuthenticated,
  getGroups,
  getDashboardSummary,
} from "@/lib/apiClient";

function lightBg(hex: string, opacity = 0.10) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function formatYen(amount: number) {
  return `¥${amount.toLocaleString()}`;
}

const CATEGORY_COLORS: Record<CategoryName, string> = {
  貯金: "#22c55e",
  住居: "#f97316",
  交通: "#38bdf8",
  食費: "#ef4444",
  娯楽: "#8b5cf6",
  医療: "#ec4899",
  日用品: "#f59e0b",
  通信: "#06b6d4",
  美容: "#e879f9",
  教育: "#6366f1",
  その他: "#94a3b8",
};

type DashboardTab = "overview" | "groups" | "categories";

export default function DashboardPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [animatedGroupTotal, setAnimatedGroupTotal] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    Promise.all([getGroups(), getDashboardSummary()])
      .then(([groupData, summaryData]) => {
        setGroups(groupData);
        setSummary(summaryData);
        setIsReady(true);
      })
      .catch(() => {
        getGroups()
          .then((groupData) => {
            setGroups(groupData);
            setSummaryError("集計の取得に失敗しました");
            setIsReady(true);
          })
          .catch(() => {
            router.replace("/login");
          });
      });
  }, [router]);

  const groupIconMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g.iconUrl] as const)),
    [groups]
  );

  const topGroup = summary?.byGroup[0] ?? null;
  const topCategory = summary?.byCategory[0] ?? null;
  const top3Groups = useMemo(() => summary?.byGroup.slice(0, 3) ?? [], [summary]);
  const top3Categories = useMemo(() => summary?.byCategory.slice(0, 3) ?? [], [summary]);
  const groupMoMRate = useMemo(() => {
    if (!summary) return null;
    const prev = summary.previousMonthTotalPersonalAmount;
    if (prev <= 0) {
      return summary.totalPersonalAmount > 0 ? 100 : 0;
    }
    return ((summary.totalPersonalAmount - prev) / prev) * 100;
  }, [summary]);

  useEffect(() => {
    if (!summary) return;
    const target = summary.totalPersonalAmount;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (nowMs: number) => {
      const progress = Math.min(1, (nowMs - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedGroupTotal(Math.round(target * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [summary?.totalPersonalAmount, activeTab, summary]);

  if (!isReady) return <RouteLoading text="グループを読み込み中..." withBottomNav />;

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1 pb-20">
        <div className="pt-2 pb-6">
          <Logo size={100} showScriptText={true} />
        </div>

        <h1 className="text-xl font-bold text-[#2d2a26] dark:text-[#eae7e1] w-full">
          ホーム
        </h1>
        <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] w-full mt-1 mb-5">
          {summary?.period.label ?? "今月"}のあなたの支出を確認できます
        </p>

        <div className="w-full rounded-2xl bg-white/80 dark:bg-[#1c1b19]/80 border border-[#ece7de] dark:border-[#2f2d2a] p-1 mb-4">
          <div className="grid grid-cols-3 gap-1">
            {[
              { key: "overview", label: "全体" },
              { key: "groups", label: "グループ" },
              { key: "categories", label: "ジャンル" },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as DashboardTab)}
                  className={[
                    "h-9 rounded-xl text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-[#c9a227] text-white"
                      : "text-[#7a756d] dark:text-[#9e9a93] hover:bg-[#f6f2ea] dark:hover:bg-[#2b2926]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {summaryError && (
          <div className="w-full mb-4 rounded-xl border border-[#f1ddd6] dark:border-[#4a2d24] bg-[#fff7f4] dark:bg-[#2b1d18] px-4 py-3 text-sm text-[#a04b36] dark:text-[#f1b29f]">
            {summaryError}
          </div>
        )}

        {activeTab === "overview" && (
          <div className="w-full flex flex-col gap-3 mb-5">
            <div className="rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-[#b78510] via-[#c9961a] to-[#a9780d]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm opacity-90">{summary?.period.label ?? "今月"}の個人合計</p>
                {groupMoMRate !== null && (
                  <span
                    className={[
                      "text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums border border-white/30",
                      groupMoMRate >= 0 ? "bg-[#7a1f1f]/35 text-white" : "bg-[#125443]/35 text-white",
                    ].join(" ")}
                  >
                    先月比 {groupMoMRate >= 0 ? "+" : ""}
                    {groupMoMRate.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-4xl font-extrabold mt-1 tabular-nums">
                {formatYen(animatedGroupTotal)}
              </p>
              <p className="text-xs mt-2 opacity-90">あなたが支払った支出の合計</p>

              <div className="mt-3 flex gap-2 flex-wrap">
                {top3Groups.map((g, i) => (
                  <span
                    key={g.groupId}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold bg-white/30 border border-white/40 text-[#2d2a26]"
                  >
                    G{i + 1}
                    <span className="max-w-[100px] truncate">{g.groupName}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#dfd7c9] dark:border-[#3a3732] bg-white dark:bg-[#1f1d1a] p-4">
                <p className="text-xs text-[#6f6a62] dark:text-[#b1aba2]">支出が多いグループ</p>
                <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1] mt-1 truncate">
                  {topGroup?.groupName ?? "データなし"}
                </p>
                <p className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] mt-1 tabular-nums">
                  {formatYen(topGroup?.amount ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#dfd7c9] dark:border-[#3a3732] bg-white dark:bg-[#1f1d1a] p-4">
                <p className="text-xs text-[#6f6a62] dark:text-[#b1aba2]">支出が多いジャンル</p>
                <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1] mt-1 truncate">
                  {topCategory?.category ?? "データなし"}
                </p>
                <p className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] mt-1 tabular-nums">
                  {formatYen(topCategory?.amount ?? 0)}
                </p>
              </div>
            </div>

            {top3Categories.length > 0 && (
              <div className="rounded-xl border border-[#dfd7c9] dark:border-[#3a3732] bg-white dark:bg-[#1f1d1a] p-4">
                <p className="text-xs text-[#6f6a62] dark:text-[#b1aba2] mb-2">TOP3ジャンル</p>
                <div className="flex gap-2 flex-wrap">
                  {top3Categories.map((c, i) => (
                    <span
                      key={c.category}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
                      style={{
                        borderColor: lightBg(CATEGORY_COLORS[c.category] ?? "#94a3b8", 0.35),
                        backgroundColor: lightBg(CATEGORY_COLORS[c.category] ?? "#94a3b8", 0.1),
                        color: CATEGORY_COLORS[c.category] ?? "#94a3b8",
                      }}
                    >
                      {i + 1}
                      <span>{c.category}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "groups" && (
          <div className="w-full flex flex-col gap-3 mb-5">
            {summary?.byGroup.length ? (
              <>
                <div className="rounded-2xl p-4 border border-[#ece7de] dark:border-[#2f2d2a] bg-gradient-to-br from-[#fff8ea] to-[#f7edd6] dark:from-[#2a261f] dark:to-[#1f1c17] shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#9e9a93] dark:text-[#9b968f] tracking-wide">
                        GROUP SUMMARY
                      </p>
                      <p className="text-sm font-semibold text-[#4a4540] dark:text-[#c5c0b8] mt-1">
                        {summary.byGroup.length}グループの合計
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] px-2 py-1 rounded-full bg-white/80 dark:bg-white/10 text-[#7a756d] dark:text-[#b9b4ac] font-semibold">
                        {summary.period.label}
                      </span>
                      {groupMoMRate !== null && (
                        <span
                          className={[
                            "text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums",
                            groupMoMRate >= 0
                              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                          ].join(" ")}
                        >
                          {groupMoMRate >= 0 ? "+" : ""}
                          {groupMoMRate.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-[#2d2a26] dark:text-[#f1ede6] tabular-nums mt-2">
                    {formatYen(animatedGroupTotal)}
                  </p>
                  <div className="mt-3">
                    <p className="text-[11px] text-[#9e9a93] dark:text-[#8e8981] mb-1">TOP3グループ</p>
                    <div className="flex gap-2 flex-wrap">
                      {top3Groups.map((g, i) => (
                        <span
                          key={g.groupId}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
                          style={{
                            borderColor: lightBg(g.groupColor, 0.35),
                            backgroundColor: lightBg(g.groupColor, 0.08),
                            color: g.groupColor,
                          }}
                        >
                          {i + 1}
                          <span className="max-w-[110px] truncate">{g.groupName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {summary.byGroup.map((item) => {
                  const pct = summary.totalPersonalAmount > 0
                    ? Math.round((item.amount / summary.totalPersonalAmount) * 100)
                    : 0;
                  const barWidth = summary.totalPersonalAmount > 0
                    ? Math.max(4, (item.amount / summary.totalPersonalAmount) * 100)
                    : 0;
                  return (
                    <div
                      key={item.groupId}
                      className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-md"
                      style={{
                        borderColor: lightBg(item.groupColor, 0.25),
                        backgroundColor: lightBg(item.groupColor, 0.04),
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                        <GroupAvatar
                          name={item.groupName}
                          color={item.groupColor}
                          iconUrl={groupIconMap.get(item.groupId)}
                          size={40}
                          className="shadow-sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#2d2a26] dark:text-[#eae7e1] truncate">
                            {item.groupName}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] tabular-nums">
                              {formatYen(item.amount)}
                            </p>
                            <p className="text-[11px] font-semibold tabular-nums" style={{ color: item.groupColor }}>
                              {pct}%
                            </p>
                          </div>
                          <Link
                            href={`/groups/${item.groupId}/settings`}
                            className="p-1.5 rounded-lg text-[#b5b0a8] dark:text-[#666360] hover:text-[#7a756d] dark:hover:text-[#9e9a93] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            title="グループ設定"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                      <div className="px-4 pb-3">
                        <div className="h-1.5 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: item.groupColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {groups
                  .filter((g) => !summary.byGroup.some((s) => s.groupId === g.id))
                  .map((g) => (
                    <div
                      key={g.id}
                      className="rounded-2xl border overflow-hidden"
                      style={{
                        borderColor: lightBg(g.color, 0.25),
                        backgroundColor: lightBg(g.color, 0.04),
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <GroupAvatar name={g.name} color={g.color} iconUrl={g.iconUrl} size={40} className="shadow-sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#2d2a26] dark:text-[#eae7e1] truncate">{g.name}</p>
                          <p className="text-xs text-[#9e9a93] dark:text-[#77736d]">今月の支出なし</p>
                        </div>
                        <Link
                          href={`/groups/${g.id}/settings`}
                          className="p-1.5 rounded-lg text-[#b5b0a8] dark:text-[#666360] hover:text-[#7a756d] dark:hover:text-[#9e9a93] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          title="グループ設定"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-dashed border-[#ddd6c8] dark:border-[#3c3a36] px-5 py-8 text-center">
                  <p className="text-4xl mb-3">👛</p>
                  <p className="text-sm font-medium text-[#8c867d] dark:text-[#8f8a84]">
                    今月のグループ支出はまだありません
                  </p>
                  <p className="text-xs text-[#b5b0a8] dark:text-[#5c5955] mt-1">
                    支出を登録すると、ここにグループ別の内訳が表示されます
                  </p>
                </div>
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      borderColor: lightBg(g.color, 0.25),
                      backgroundColor: lightBg(g.color, 0.04),
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <GroupAvatar name={g.name} color={g.color} iconUrl={g.iconUrl} size={40} className="shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#2d2a26] dark:text-[#eae7e1] truncate">{g.name}</p>
                        <p className="text-xs text-[#9e9a93] dark:text-[#77736d]">{g.members.length}人のメンバー</p>
                      </div>
                      <Link
                        href={`/groups/${g.id}/settings`}
                        className="p-1.5 rounded-lg text-[#b5b0a8] dark:text-[#666360] hover:text-[#7a756d] dark:hover:text-[#9e9a93] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        title="グループ設定"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "categories" && (
          <div className="w-full flex flex-col gap-3 mb-5">
            {summary?.byCategory.length ? (
              <>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-xs text-[#9e9a93] dark:text-[#77736d]">
                    {summary.byCategory.length}ジャンルの合計
                  </p>
                  <p className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] tabular-nums">
                    {formatYen(summary.totalPersonalAmount)}
                  </p>
                </div>

                {summary.byCategory.map((item, idx) => {
                  const color = CATEGORY_COLORS[item.category] ?? "#94a3b8";
                  const pct = summary.totalPersonalAmount > 0
                    ? Math.round((item.amount / summary.totalPersonalAmount) * 100)
                    : 0;
                  const barWidth = summary.totalPersonalAmount > 0
                    ? Math.max(4, (item.amount / summary.totalPersonalAmount) * 100)
                    : 0;
                  const isTop = idx === 0;
                  return (
                    <div
                      key={item.category}
                      className={[
                        "rounded-2xl border overflow-hidden transition-shadow hover:shadow-md",
                        isTop ? "ring-1" : "",
                      ].join(" ")}
                      style={{
                        borderColor: lightBg(color, 0.25),
                        backgroundColor: lightBg(color, 0.04),
                        ...(isTop ? { ringColor: lightBg(color, 0.15) } : {}),
                      }}
                    >
                      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                        <div
                          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: lightBg(color, 0.14) }}
                        >
                          <CategoryIcon
                            category={item.category}
                            size={22}
                            style={{ color }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#2d2a26] dark:text-[#eae7e1]">
                              {item.category}
                            </p>
                            {isTop && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none"
                                style={{ backgroundColor: color }}
                              >
                                TOP
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] tabular-nums">
                            {formatYen(item.amount)}
                          </p>
                          <p className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                            {pct}%
                          </p>
                        </div>
                      </div>
                      <div className="px-4 pb-3">
                        <div className="h-1.5 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#ddd6c8] dark:border-[#3c3a36] px-5 py-10 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm font-medium text-[#8c867d] dark:text-[#8f8a84]">
                  今月のジャンル支出はまだありません
                </p>
                <p className="text-xs text-[#b5b0a8] dark:text-[#5c5955] mt-1">
                  支出を登録すると、ここにジャンル別の内訳が表示されます
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab !== "categories" && (
          <div className="w-full mb-4">
            <Link
              href="/groups/new"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-[#c9a227] hover:brightness-105"
            >
              + グループ作成
            </Link>
          </div>
        )}
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

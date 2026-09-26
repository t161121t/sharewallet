"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PageTransition from "@/components/layout/PageTransition";
import RouteLoading from "@/components/layout/RouteLoading";
import ScreenContainer from "@/components/layout/ScreenContainer";
import CategoryIcon from "@/components/icons/CategoryIcon";
import ExpensePieChart, { type ExpenseCategory } from "@/components/ui/ExpensePieChart";
import { getDashboardSummary, getDashboardTrend, isAuthenticated } from "@/lib/apiClient";
import type { CategoryName, DashboardSummary, DashboardTrend } from "@/types";

const CATEGORY_COLORS: Record<CategoryName, string> = { 貯金: "#22c55e", 住居: "#f97316", 交通: "#38bdf8", 食費: "#ef4444", 娯楽: "#8b5cf6", 医療: "#ec4899", 日用品: "#f59e0b", 通信: "#06b6d4", 美容: "#e879f9", 教育: "#6366f1", その他: "#94a3b8" };
function formatYen(amount: number) { return `¥${amount.toLocaleString()}`; }
function shiftMonth(year: number, month: number, offset: number) { const date = new Date(year, month - 1 + offset, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; }

export default function AnalysisPage() {
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<DashboardTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    setLoading(true); setError(null);
    Promise.all([getDashboardSummary(period.year, period.month), getDashboardTrend(period.year, period.month)])
      .then(([summaryData, trendData]) => { setSummary(summaryData); setTrend(trendData); })
      .catch(() => setError("分析データの取得に失敗しました。もう一度お試しください。"))
      .finally(() => setLoading(false));
  }, [period, router]);

  const mom = useMemo(() => {
    if (!summary || summary.previousMonthTotalPersonalAmount === 0) return null;
    return ((summary.totalPersonalAmount - summary.previousMonthTotalPersonalAmount) / summary.previousMonthTotalPersonalAmount) * 100;
  }, [summary]);
  const maxTrend = Math.max(...(trend?.points.map((point) => point.totalPersonalAmount) ?? [0]), 1);
  const pieData: ExpenseCategory[] = (summary?.byCategory ?? []).map((item) => ({
    name: item.category,
    value: item.amount,
    color: CATEGORY_COLORS[item.category],
  }));
  if (loading && !summary) return <RouteLoading text="分析を読み込み中..." withBottomNav />;

  return <ScreenContainer><PageTransition className="w-full flex-1 pb-28">
    <header className="flex items-start justify-between pt-1 pb-6"><div><h1 className="text-3xl font-extrabold text-[#2d2a26] dark:text-[#eae7e1]">分析</h1><p className="mt-1 text-sm text-[#7a756d] dark:text-[#9e9a93]">支出の流れを、月ごとに確認。</p></div><div className="flex gap-1"><button aria-label="前の月" type="button" onClick={() => setPeriod((current) => shiftMonth(current.year, current.month, -1))} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[#7a756d] hover:bg-[#f0ece6]">‹</button><button aria-label="次の月" type="button" onClick={() => setPeriod((current) => shiftMonth(current.year, current.month, 1))} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[#7a756d] hover:bg-[#f0ece6]">›</button></div></header>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <div className="space-y-4">
      <section className="rounded-3xl border border-[#ece7de] bg-white p-5 shadow-sm dark:border-[#2f2d2a] dark:bg-[#1c1b19]"><p className="text-sm font-semibold text-[#7a756d] dark:text-[#9e9a93]">{period.year}年{period.month}月の支出</p><div className="mt-1 flex items-end justify-between gap-3"><p className="text-4xl font-extrabold tabular-nums text-[#2d2a26] dark:text-[#eae7e1]">{formatYen(summary?.totalPersonalAmount ?? 0)}</p>{mom !== null && <span className={["mb-1 rounded-full px-3 py-1 text-xs font-bold", mom > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"].join(" ")}>先月比 {mom > 0 ? "+" : ""}{mom.toFixed(1)}%</span>}</div><p className="mt-2 text-xs text-[#7a756d] dark:text-[#9e9a93]">先月 {formatYen(summary?.previousMonthTotalPersonalAmount ?? 0)}</p></section>
      <section className="rounded-3xl border border-[#ece7de] bg-white p-5 shadow-sm dark:border-[#2f2d2a] dark:bg-[#1c1b19]"><h2 className="font-bold text-[#2d2a26] dark:text-[#eae7e1]">カテゴリ別</h2>{summary?.byCategory.length ? <><ExpensePieChart size={220} data={pieData} /><div className="mt-4 space-y-4">{summary.byCategory.slice(0, 5).map((item) => { const color = CATEGORY_COLORS[item.category]; const ratio = summary.totalPersonalAmount ? (item.amount / summary.totalPersonalAmount) * 100 : 0; return <div key={item.category}><div className="flex items-center gap-2 text-sm"><CategoryIcon category={item.category} size={17} style={{ color }} /><span className="flex-1 font-semibold text-[#2d2a26] dark:text-[#eae7e1]">{item.category}</span><span className="font-bold tabular-nums text-[#2d2a26] dark:text-[#eae7e1]">{formatYen(item.amount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0ece6] dark:bg-[#2f2d2a]"><div className="h-full rounded-full" style={{ width: `${ratio}%`, backgroundColor: color }} /></div></div>; })}</div></> : <p className="mt-4 text-sm text-[#7a756d] dark:text-[#9e9a93]">この月の支出はまだありません。</p>}</section>
      <section className="rounded-3xl border border-[#ece7de] bg-white p-5 shadow-sm dark:border-[#2f2d2a] dark:bg-[#1c1b19]"><h2 className="font-bold text-[#2d2a26] dark:text-[#eae7e1]">6か月の推移</h2><p className="mt-1 text-xs text-[#7a756d] dark:text-[#9e9a93]">{period.month}月までの個人支出</p><div className="mt-5 flex h-40 items-end justify-between gap-2">{trend?.points.map((point) => <div key={`${point.year}-${point.month}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] font-semibold tabular-nums text-[#7a756d] dark:text-[#9e9a93]">{point.totalPersonalAmount ? `${Math.round(point.totalPersonalAmount / 1000)}k` : ""}</span><div className="w-full max-w-8 rounded-t-lg bg-[#f5d678] transition-all" style={{ height: `${Math.max(point.totalPersonalAmount ? 10 : 2, (point.totalPersonalAmount / maxTrend) * 100)}%` }} /><span className={point.month === period.month ? "text-xs font-bold text-[#c9a227]" : "text-xs text-[#7a756d] dark:text-[#9e9a93]"}>{point.label}</span></div>)}</div></section>
    </div>}
  </PageTransition><BottomNav /></ScreenContainer>;
}

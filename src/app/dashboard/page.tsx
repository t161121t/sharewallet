"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PageTransition from "@/components/layout/PageTransition";
import RouteLoading from "@/components/layout/RouteLoading";
import ScreenContainer from "@/components/layout/ScreenContainer";
import CategoryIcon from "@/components/icons/CategoryIcon";
import { getDashboardCalendar, getDashboardSummary, isAuthenticated } from "@/lib/apiClient";
import type { CategoryName, DashboardCalendar, DashboardSummary } from "@/types";

const CATEGORY_COLORS: Record<CategoryName, string> = {
  貯金: "#22c55e", 住居: "#f97316", 交通: "#38bdf8", 食費: "#ef4444", 娯楽: "#8b5cf6",
  医療: "#ec4899", 日用品: "#f59e0b", 通信: "#06b6d4", 美容: "#e879f9", 教育: "#6366f1", その他: "#94a3b8",
};
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatYen(amount: number) { return `¥${amount.toLocaleString()}`; }
function monthLabel(year: number, month: number) { return `${year}年${month}月`; }
function toDateKey(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function DashboardPage() {
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [calendar, setCalendar] = useState<DashboardCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace("/login"); return; }
    let isCurrent = true;
    setLoading(true); setError(null);
    Promise.all([getDashboardSummary(period.year, period.month), getDashboardCalendar(period.year, period.month)])
      .then(([summaryData, calendarData]) => {
        if (!isCurrent) return;
        setSummary(summaryData); setCalendar(calendarData);
        setSelectedDate((current) => current && calendarData.days.some((day) => day.date === current)
          ? current : calendarData.days[0]?.date ?? null);
      })
      .catch(() => { if (isCurrent) setError("支出の取得に失敗しました。もう一度お試しください。"); })
      .finally(() => { if (isCurrent) setLoading(false); });
    return () => { isCurrent = false; };
  }, [period, router]);

  const daysByDate = useMemo(() => new Map(calendar?.days.map((day) => [day.date, day]) ?? []), [calendar]);
  const selectedDay = selectedDate ? daysByDate.get(selectedDate) : undefined;
  const firstWeekday = new Date(period.year, period.month - 1, 1).getDay();
  const daysInMonth = new Date(period.year, period.month, 0).getDate();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  if (loading && !calendar) return <RouteLoading text="カレンダーを読み込み中..." withBottomNav />;
  return (
    <ScreenContainer>
      <PageTransition className="w-full flex-1 pb-28">
        <header className="pt-1 pb-6">
          <p
            className="pb-3 text-4xl text-[#2d2a26] dark:text-[#eae7e1]"
            style={{ fontFamily: "var(--font-dancing-script), cursive" }}
          >
            Share Wallet
          </p>
          <p className="mt-1 text-sm text-[#7a756d] dark:text-[#9e9a93]">今日の支出を、あとから思い出せる。</p>
        </header>
        <section className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2d2a26] dark:text-[#eae7e1]">{monthLabel(period.year, period.month)}</h1>
            <p className="mt-2 text-sm text-[#7a756d] dark:text-[#9e9a93]">今月のあなたの支出</p>
            <p className="text-4xl font-extrabold tabular-nums text-[#2d2a26] dark:text-[#eae7e1]">{formatYen(summary?.totalPersonalAmount ?? 0)}</p>
          </div>
          <div className="flex items-center gap-1 self-start pt-2">
            <button aria-label="前の月" type="button" onClick={() => setPeriod((current) => shiftMonth(current.year, current.month, -1))} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[#7a756d] hover:bg-[#f0ece6] dark:hover:bg-[#2b2926]">‹</button>
            <button aria-label="次の月" type="button" onClick={() => setPeriod((current) => shiftMonth(current.year, current.month, 1))} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[#7a756d] hover:bg-[#f0ece6] dark:hover:bg-[#2b2926]">›</button>
          </div>
        </section>
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <>
          <section className="rounded-3xl border border-[#ece7de] bg-white p-4 shadow-sm dark:border-[#2f2d2a] dark:bg-[#1c1b19]">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-[#2d2a26] dark:text-[#eae7e1]">{period.month}月の記録</h2><span className="text-xs text-[#7a756d] dark:text-[#9e9a93]">{calendar?.days.reduce((sum, day) => sum + day.expenseCount, 0) ?? 0}件</span></div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#7a756d] dark:text-[#9e9a93]">{WEEKDAYS.map((weekday, index) => <span key={weekday} className={index === 0 ? "text-red-500" : index === 6 ? "text-[#c9a227]" : ""}>{weekday}</span>)}</div>
            <div className="mt-2 grid grid-cols-7 gap-y-1">{calendarCells.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12" />;
              const date = toDateKey(period.year, period.month, day); const record = daysByDate.get(date); const isSelected = selectedDate === date; const weekday = (firstWeekday + day - 1) % 7;
              return <button key={date} type="button" onClick={() => setSelectedDate(date)} className="flex h-12 flex-col items-center justify-center rounded-2xl transition-colors hover:bg-[#f6f2ea] dark:hover:bg-[#2b2926]" aria-pressed={isSelected}>
                <span className={["grid h-8 w-8 place-items-center rounded-full text-sm font-semibold", isSelected ? "bg-[#c9a227] text-white" : weekday === 0 ? "text-red-500" : weekday === 6 ? "text-[#c9a227]" : "text-[#2d2a26] dark:text-[#eae7e1]"].join(" ")}>{day}</span><span className={["mt-0.5 h-1.5 w-1.5 rounded-full", record ? "bg-[#c9a227]" : "bg-transparent"].join(" ")} />
              </button>;
            })}</div>
          </section>
          <section className="mt-4 rounded-3xl border border-[#ece7de] bg-white p-4 shadow-sm dark:border-[#2f2d2a] dark:bg-[#1c1b19]">
            {selectedDay ? <>
              <div className="flex items-start justify-between gap-3 border-b border-[#f0ece6] pb-3 dark:border-[#2f2d2a]"><div><h2 className="font-bold text-[#2d2a26] dark:text-[#eae7e1]">{period.month}月{Number(selectedDay.date.slice(-2))}日の明細</h2><p className="mt-0.5 text-xs text-[#7a756d] dark:text-[#9e9a93]">{selectedDay.expenseCount}件の支出</p></div><p className="text-lg font-extrabold tabular-nums text-[#2d2a26] dark:text-[#eae7e1]">{formatYen(selectedDay.totalPersonalAmount)}</p></div>
              <div className="divide-y divide-[#f0ece6] dark:divide-[#2f2d2a]">{selectedDay.expenses.map((expense) => <div key={expense.id} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${CATEGORY_COLORS[expense.category]}20`, color: CATEGORY_COLORS[expense.category] }}><CategoryIcon category={expense.category} size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1]">{expense.memo || expense.category}</p><p className="truncate text-xs text-[#7a756d] dark:text-[#9e9a93]">{expense.groupName}</p></div><p className="font-bold tabular-nums text-[#2d2a26] dark:text-[#eae7e1]">{formatYen(expense.amount)}</p></div>)}</div>
              <Link href="/expense/history" className="mt-2 block text-right text-sm font-bold text-[#c9a227]">すべての明細を見る ›</Link>
            </> : <div className="py-5 text-center"><p className="font-semibold text-[#2d2a26] dark:text-[#eae7e1]">この日の支出はありません</p><p className="mt-1 text-sm text-[#7a756d] dark:text-[#9e9a93]">別の日を選ぶか、支出を入力してください。</p></div>}
          </section>
        </>}
      </PageTransition>
      <BottomNav />
    </ScreenContainer>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import GroupBanner from "@/components/ui/GroupBanner";
import ExpensePieChart, { type ExpenseCategory } from "@/components/ui/ExpensePieChart";
import GenreSelect from "@/components/ui/GenreSelect";
import PrimaryButton from "@/components/ui/PrimaryButton";
import MemberAvatar from "@/components/ui/MemberAvatar";
import type { Group, CategoryName, ExpenseRecord } from "@/types";
import {
  isAuthenticated,
  getGroups,
  getSelectedGroupId,
  setSelectedGroupId,
  getGroup,
  getExpenses,
  createExpense,
  ApiClientError,
} from "@/lib/apiClient";

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

function normalizeCategory(category: string): CategoryName {
  if (category === "交通費") return "交通";
  if (category === "住居費") return "住居";
  if (category === "通信費") return "通信";
  if (category === "医療費") return "医療";
  const valid: CategoryName[] = [
    "貯金", "住居", "交通", "食費", "娯楽",
    "医療", "日用品", "通信", "美容", "教育", "その他",
  ];
  if (valid.includes(category as CategoryName)) return category as CategoryName;
  return "その他";
}

export default function ExpensePage() {
  const router = useRouter();
  const [genre, setGenre] = useState("");
  const [amount, setAmount] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [shares, setShares] = useState<Record<string, string>>({});

  const pieData = useMemo<ExpenseCategory[]>(() => {
    const sumByCategory: Record<CategoryName, number> = {
      貯金: 0,
      住居: 0,
      交通: 0,
      食費: 0,
      娯楽: 0,
      医療: 0,
      日用品: 0,
      通信: 0,
      美容: 0,
      教育: 0,
      その他: 0,
    };
    for (const e of expenses) {
      const normalized = normalizeCategory(e.category);
      sumByCategory[normalized] += e.amount;
    }
    return (Object.keys(sumByCategory) as CategoryName[]).map((category) => ({
      name: category,
      value: sumByCategory[category],
      color: CATEGORY_COLORS[category],
    }));
  }, [expenses]);

  const loadGroupData = async (groupId: string, withSwitchLoading = false) => {
    if (withSwitchLoading) setSwitchingGroup(true);
    const [groupData, expensesData] = await Promise.all([getGroup(groupId), getExpenses(groupId)]);
    setGroup(groupData);
    setExpenses(expensesData);
    const n = groupData.members.length;
    const base = Math.floor(100 / n / 10) * 10;
    const extra = (100 - base * n) / 10;
    const initial = Object.fromEntries(
      groupData.members.map((m, i) => [m.id, String(base + (i < extra ? 10 : 0))])
    );
    setShares(initial);
    setSelectedGroupId(groupData.id);
    if (withSwitchLoading) setSwitchingGroup(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    getGroups()
      .then(async (groupList) => {
        setMyGroups(groupList);
        if (groupList.length === 0) {
          setIsReady(true);
          return;
        }
        const savedId = getSelectedGroupId();
        const resolvedId =
          savedId && groupList.some((g) => g.id === savedId) ? savedId : groupList[0].id;
        await loadGroupData(resolvedId);
        setIsReady(true);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [router]);

  const handleGroupChange = async (nextGroupId: string) => {
    if (!nextGroupId || nextGroupId === group?.id) return;
    try {
      await loadGroupData(nextGroupId, true);
    } catch {
      toast.error("グループ切替に失敗しました");
      setSwitchingGroup(false);
    }
  };

  const handleRegister = async () => {
    if (!genre || !amount) {
      toast.error("ジャンルと金額を入力してください");
      return;
    }
    if (!group) return;
    const shareItems = group.members.map((m) => ({
      userId: m.id,
      percent: Number(shares[m.id] || 0),
    }));
    const totalPercent = shareItems.reduce((s, item) => s + item.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      toast.error("配分比率の合計を100%にしてください");
      return;
    }

    setLoading(true);
    try {
      const created = await createExpense(group.id, {
        category: normalizeCategory(genre),
        amount: Number(amount),
        memo: "",
        shares: shareItems,
      });
      setExpenses((prev) => [created, ...prev]);
      toast.success("支出を登録しました");
      setGenre("");
      setAmount("");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("登録に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return <RouteLoading text="支出入力画面を準備中..." withBottomNav />;
  }
  if (!group) {
    return (
      <ScreenContainer>
        <PageTransition className="flex flex-col items-center w-full flex-1 pb-20">
          <p className="text-4xl text-[#2d2a26] dark:text-[#eae7e1] pb-3" style={{ fontFamily: "var(--font-dancing-script), cursive" }}>
            Share Wallet
          </p>
          <div className="w-full rounded-2xl border border-dashed border-[#ddd6c8] dark:border-[#3c3a36] px-5 py-10 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-sm font-medium text-[#8c867d] dark:text-[#8f8a84]">まだグループがありません</p>
            <p className="text-xs text-[#b5b0a8] dark:text-[#5c5955] mt-1">先にグループを作成してください</p>
          </div>
        </PageTransition>
        <BottomNav />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full flex-1 pb-20">
        {/* アプリ名 */}
        <p
          className="text-4xl text-[#2d2a26] dark:text-[#eae7e1] pb-3"
          style={{ fontFamily: "var(--font-dancing-script), cursive" }}
        >
          Share Wallet
        </p>

        {/* グループバナー */}
        <div className="w-full">
          <GroupBanner group={group} />
        </div>

        <label className="w-full mt-4">
          <div className="text-sm font-semibold text-[#4a4540] dark:text-[#c5c0b8] mb-2">
            入力対象グループ
          </div>
          <select
            value={group.id}
            onChange={(e) => handleGroupChange(e.target.value)}
            className={[
              "w-full h-11 rounded-xl px-3 outline-none appearance-none cursor-pointer text-sm",
              "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
              "text-[#2d2a26] dark:text-[#eae7e1]",
              "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
            ].join(" ")}
          >
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {switchingGroup && (
            <p className="text-xs text-[#9e9a93] dark:text-[#77736d] mt-1">グループを切り替え中...</p>
          )}
        </label>

        {/* ページタイトル */}
        <h1 className="text-xl font-bold text-[#2d2a26] dark:text-[#eae7e1] w-full text-center mt-5">
          共有金額入力
        </h1>

        {/* 円グラフ + 凡例 */}
        <div className="w-full mt-3">
          <ExpensePieChart size={200} data={pieData} />
        </div>

        {/* 入力フォーム */}
        <div className="flex flex-col gap-4 w-full mt-5">
          <GenreSelect value={genre} onChange={setGenre} />

          <label className="w-full">
            <div className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-2">
              使った金額
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="使った金額"
              value={amount === "" ? "" : `${amount}円`}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setAmount(v);
              }}
              className={[
                "w-full h-13 rounded-xl px-4 outline-none text-base",
                "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
                "text-[#2d2a26] dark:text-[#eae7e1]",
                "placeholder:text-[#b5b0a8] dark:placeholder:text-[#666360]",
                "transition-all duration-200 ease-out",
                "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
              ].join(" ")}
              aria-label="使った金額を入力"
            />
          </label>

          <div className="pt-1">
            <PrimaryButton onClick={handleRegister} loading={loading}>
              登録
            </PrimaryButton>
          </div>

          {(() => {
            const total = group.members.reduce(
              (sum, m) => sum + Number(shares[m.id] || 0),
              0
            );
            const isValid = total === 100;
            return (
              <div className="rounded-xl p-4 border border-[#e5e0d8] dark:border-[#333230]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1]">
                    負担比率（10%単位）
                  </p>
                  <span
                    className={[
                      "text-xs font-bold px-2 py-0.5 rounded-full",
                      isValid
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
                    ].join(" ")}
                  >
                    合計 {total}%
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {group.members.map((m) => {
                    const val = Number(shares[m.id] || 0);
                    return (
                      <div key={m.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <MemberAvatar
                              name={m.name}
                              color={m.color}
                              avatarUrl={m.avatarUrl}
                              size={24}
                            />
                            <span className="text-sm text-[#4a4540] dark:text-[#c5c0b8] truncate">
                              {m.name}
                            </span>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-[#2d2a26] dark:text-[#eae7e1] w-12 text-right">
                            {val}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={10}
                          value={val}
                          onChange={(e) =>
                            setShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          style={{ accentColor: m.color }}
                          className="w-full h-2 rounded-full cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

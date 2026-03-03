"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import GroupBanner from "@/components/ui/GroupBanner";
import GroupSwitcher from "@/components/ui/GroupSwitcher";
import ExpensePieChart, { type ExpenseCategory } from "@/components/ui/ExpensePieChart";
import GenreSelect from "@/components/ui/GenreSelect";
import PrimaryButton from "@/components/ui/PrimaryButton";
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
  貯金: "#34a853",
  住居: "#e67e22",
  交通: "#3498db",
  食費: "#e74c3c",
  娯楽: "#9b59b6",
  その他: "#94a3b8",
};

function normalizeCategory(category: string): CategoryName {
  if (category === "交通費") return "交通";
  if (category === "住居費") return "住居";
  if (
    category === "貯金" ||
    category === "住居" ||
    category === "交通" ||
    category === "食費" ||
    category === "娯楽" ||
    category === "その他"
  ) {
    return category;
  }
  return "その他";
}

export default function ExpensePage() {
  const router = useRouter();
  const [genre, setGenre] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [shares, setShares] = useState<Record<string, string>>({});

  const loadGroupData = useCallback(async (groupId: string) => {
    const [groupData, expensesData] = await Promise.all([getGroup(groupId), getExpenses(groupId)]);
    setGroup(groupData);
    setExpenses(expensesData);
    setSelectedGroupIdState(groupId);
    const initial = Object.fromEntries(
      groupData.members.map((m) => [m.id, (100 / groupData.members.length).toFixed(2)])
    );
    setShares(initial);
  }, []);

  const pieData = useMemo<ExpenseCategory[]>(() => {
    const sumByCategory: Record<CategoryName, number> = {
      貯金: 0,
      住居: 0,
      交通: 0,
      食費: 0,
      娯楽: 0,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    getGroups()
      .then(async (groupList) => {
        setGroups(groupList);
        if (groupList.length === 0) {
          router.replace("/groups/new");
          return;
        }
        const savedId = getSelectedGroupId();
        const initialGroupId =
          savedId && groupList.some((g) => g.id === savedId) ? savedId : groupList[0].id;
        setSelectedGroupId(initialGroupId);
        await loadGroupData(initialGroupId);
        setIsReady(true);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [loadGroupData, router]);

  const handleGroupChange = async (groupId: string) => {
    if (!groupId || groupId === selectedGroupId) return;
    setSwitchingGroup(true);
    try {
      setSelectedGroupId(groupId);
      await loadGroupData(groupId);
      toast.success("グループを切り替えました");
    } catch {
      toast.error("グループ切り替えに失敗しました");
    } finally {
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
        memo: memo.trim() || undefined,
        shares: shareItems,
      });
      setExpenses((prev) => [created, ...prev]);
      toast.success("支出を登録しました");
      setGenre("");
      setAmount("");
      setMemo("");
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

  if (!isReady || !group) {
    return <RouteLoading text="支出入力画面を準備中..." withBottomNav />;
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
        <GroupSwitcher
          groups={groups}
          selectedGroupId={selectedGroupId}
          onChange={handleGroupChange}
          disabled={switchingGroup}
          className="mb-3"
        />

        {/* グループバナー */}
        <div className="w-full">
          <GroupBanner group={group} />
        </div>

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

          <label className="w-full">
            <div className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-2">
              メモ（任意）
            </div>
            <input
              type="text"
              placeholder="例: スーパーまとめ買い"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={[
                "w-full h-12 rounded-xl px-4 outline-none text-base",
                "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
                "text-[#2d2a26] dark:text-[#eae7e1]",
                "placeholder:text-[#b5b0a8] dark:placeholder:text-[#666360]",
                "transition-all duration-200 ease-out",
                "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
              ].join(" ")}
              aria-label="メモを入力"
            />
          </label>

          <div className="pt-1">
            <PrimaryButton onClick={handleRegister} loading={loading}>
              登録
            </PrimaryButton>
          </div>

          <div className="rounded-xl p-4 border border-[#e5e0d8] dark:border-[#333230]">
            <p className="text-sm font-semibold text-[#2d2a26] dark:text-[#eae7e1] mb-3">
              負担比率（%）
            </p>
            <div className="flex flex-col gap-2">
              {group.members.map((m) => (
                <label key={m.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#4a4540] dark:text-[#c5c0b8]">
                    {m.name}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={shares[m.id] ?? ""}
                    onChange={(e) =>
                      setShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    className="w-28 h-10 rounded-lg px-3 border border-[#e5e0d8] dark:border-[#333230] bg-white dark:bg-[#1c1b19]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  analyzeReceipt,
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

/** Canvas で画像を最大 1024px・JPEG 0.8 品質にリサイズして base64 を返す */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas error")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load error")); };
    img.src = url;
  });
}

export default function ExpensePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [genre, setGenre] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const pieData = useMemo<ExpenseCategory[]>(() => {
    const sumByCategory: Record<CategoryName, number> = {
      貯金: 0, 住居: 0, 交通: 0, 食費: 0, 娯楽: 0,
      医療: 0, 日用品: 0, 通信: 0, 美容: 0, 教育: 0, その他: 0,
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
        if (groupList.length === 0) { setIsReady(true); return; }
        const savedId = getSelectedGroupId();
        const resolvedId =
          savedId && groupList.some((g) => g.id === savedId) ? savedId : groupList[0].id;
        await loadGroupData(resolvedId);
        setIsReady(true);
      })
      .catch(() => { router.replace("/dashboard"); });
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

  const handleReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // input をリセットして同じファイルを再選択できるようにする
    e.target.value = "";

    setAnalyzing(true);
    try {
      const base64 = await compressImage(file);
      setReceiptPreview(base64);
      const result = await analyzeReceipt(base64);

      if (result.amount !== null) {
        setAmount(String(result.amount));
      }
      if (result.category) {
        setGenre(result.category);
      }
      if (result.memo) {
        setMemo(result.memo);
      }

      if (result.confidence === "low") {
        toast("読み取り精度が低い可能性があります。内容をご確認ください", { icon: "⚠️" });
      } else {
        toast.success("レシートを読み取りました");
      }
    } catch (err) {
      setReceiptPreview(null);
      if (err instanceof ApiClientError) {
        toast.error(err.message);
      } else {
        toast.error("レシートの読み取りに失敗しました。手入力してください");
      }
    } finally {
      setAnalyzing(false);
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
        memo: memo || undefined,
        shares: shareItems,
      });
      setExpenses((prev) => [created, ...prev]);
      toast.success("支出を登録しました");
      setGenre("");
      setAmount("");
      setMemo("");
      setReceiptPreview(null);
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

  const isFormDisabled = analyzing || loading;

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
            disabled={isFormDisabled}
            className={[
              "w-full h-11 rounded-xl px-3 outline-none appearance-none cursor-pointer text-sm",
              "bg-white dark:bg-[#1c1b19] border border-[#e5e0d8] dark:border-[#333230]",
              "text-[#2d2a26] dark:text-[#eae7e1]",
              "focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
              "disabled:opacity-50",
            ].join(" ")}
          >
            {myGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {switchingGroup && (
            <p className="text-xs text-[#9e9a93] dark:text-[#77736d] mt-1">グループを切り替え中...</p>
          )}
        </label>

        {/* ページタイトル + レシートボタン */}
        <div className="flex items-center justify-between w-full mt-5">
          <h1 className="text-xl font-bold text-[#2d2a26] dark:text-[#eae7e1]">
            共有金額入力
          </h1>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isFormDisabled}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium",
              "bg-[#c9a227]/10 text-[#c9a227] border border-[#c9a227]/30",
              "hover:bg-[#c9a227]/20 transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="レシートを読み取る"
          >
            {analyzing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                解析中...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                レシート読取
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleReceiptSelect}
          />
        </div>

        {/* レシートプレビュー */}
        {receiptPreview && (
          <div className="w-full mt-3 relative">
            <img
              src={receiptPreview}
              alt="レシートプレビュー"
              className="w-full max-h-40 object-contain rounded-xl border border-[#e5e0d8] dark:border-[#333230]"
            />
            <button
              type="button"
              onClick={() => setReceiptPreview(null)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
              aria-label="プレビューを閉じる"
            >
              ✕
            </button>
          </div>
        )}

        {/* 円グラフ + 凡例 */}
        <div className="w-full mt-3">
          <ExpensePieChart size={200} data={pieData} />
        </div>

        {/* 入力フォーム */}
        <fieldset disabled={isFormDisabled} className="flex flex-col gap-4 w-full mt-5 disabled:opacity-60">
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
              placeholder="店名・内容など"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={[
                "w-full h-13 rounded-xl px-4 outline-none text-base",
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
        </fieldset>
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

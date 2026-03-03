"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import CategoryIcon from "@/components/icons/CategoryIcon";
import GroupSwitcher from "@/components/ui/GroupSwitcher";
import BudgetProgressPanel from "@/components/ui/BudgetProgressPanel";
import type {
  Group,
  ExpenseRecord,
  CategoryName,
  CategoryBudget,
  BudgetProgressResponse,
} from "@/types";
import {
  isAuthenticated,
  getGroups,
  getSelectedGroupId,
  setSelectedGroupId,
  getGroup,
  getExpenses,
  getMe,
  updateExpense,
  deleteExpense,
  getCategoryBudgets,
  getBudgetProgress,
  updateCategoryBudgets,
  ApiClientError,
} from "@/lib/apiClient";

/** カテゴリの色マップ */
const CATEGORY_COLORS: Record<CategoryName, string> = {
  貯金: "#22c55e",
  住居: "#f97316",
  交通: "#38bdf8",
  食費: "#ef4444",
  娯楽: "#8b5cf6",
  その他: "#94a3b8",
};

/** メンバー色マップ */
const MEMBER_COLORS: Record<string, string> = {
  u1: "#F59E0B",
  u2: "#3B82F6",
  u3: "#EC4899",
  u4: "#10B981",
};

/* ---------- 日付フォーマット ---------- */

function formatDate(iso: string) {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const w = weekdays[d.getDay()];
  return `${m}/${day}（${w}）`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/* ---------- 日付ごとにグループ化 ---------- */

function groupByDate(expenses: ExpenseRecord[]) {
  const map = new Map<string, ExpenseRecord[]>();
  for (const e of expenses) {
    const key = e.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
}

/* ---------- サマリーカード ---------- */

function SummaryCard({ expenses, group }: { expenses: ExpenseRecord[]; group: Group }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const perPerson = Math.round(total / group.members.length);

  return (
    <div
      className="w-full rounded-2xl p-5 text-white shadow-lg"
      style={{
        background: "linear-gradient(135deg, #d4a320 0%, #e8c547 50%, #c9a227 100%)",
      }}
    >
      <p className="text-sm font-medium opacity-90">今月の合計</p>
      <p className="text-3xl font-bold mt-1 tabular-nums">
        ¥{total.toLocaleString()}
      </p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/30">
        <div>
          <p className="text-xs opacity-80">1人あたり</p>
          <p className="text-lg font-bold tabular-nums">
            ¥{perPerson.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">件数</p>
          <p className="text-lg font-bold tabular-nums">{expenses.length}件</p>
        </div>
        <div>
          <p className="text-xs opacity-80">メンバー</p>
          <p className="text-lg font-bold tabular-nums">
            {group.members.length}人
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- 支出アイテム ---------- */

function ExpenseItem({
  expense,
  onEdit,
  onDelete,
  canEdit,
}: {
  expense: ExpenseRecord;
  onEdit: (expense: ExpenseRecord) => void;
  onDelete: (expenseId: string) => void;
  canEdit: boolean;
}) {
  const color = CATEGORY_COLORS[expense.category] ?? "#94a3b8";
  const memberColor = MEMBER_COLORS[expense.memberId] ?? "#6b7280";

  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18` }}
      >
        <CategoryIcon category={expense.category} size={22} style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-[#2d2a26] dark:text-[#eae7e1] truncate">
            {expense.memo || expense.category}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: memberColor }}
          >
            {expense.memberAvatarUrl ? (
              <span className="relative w-3.5 h-3.5 rounded-full overflow-hidden bg-white/20">
                <Image
                  src={expense.memberAvatarUrl}
                  alt={expense.memberName}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="14px"
                />
              </span>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width={12} height={12}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
            {expense.memberName}
          </span>
          <span className="text-xs text-[#9e9a93] dark:text-[#666360]">
            {formatTime(expense.date)}
          </span>
        </div>
      </div>

      <span className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] tabular-nums shrink-0">
        ¥{expense.amount.toLocaleString()}
      </span>
      <button
        type="button"
        onClick={() => onEdit(expense)}
        disabled={!canEdit}
        className={[
          "text-xs underline",
          canEdit
            ? "text-[#7a756d] dark:text-[#9e9a93]"
            : "text-[#b5b0a8] dark:text-[#666360] cursor-not-allowed",
        ].join(" ")}
      >
        編集
      </button>
      <button
        type="button"
        onClick={() => onDelete(expense.id)}
        disabled={!canEdit}
        className={[
          "text-xs underline",
          canEdit ? "text-red-500" : "text-red-300 dark:text-red-800 cursor-not-allowed",
        ].join(" ")}
      >
        削除
      </button>
    </div>
  );
}

/* ---------- ページ ---------- */

export default function HistoryPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isSwitchingGroup, setIsSwitchingGroup] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupIdState] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canManageAll, setCanManageAll] = useState(false);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgressResponse | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);

  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  };
  const currentMonth = getCurrentMonthKey();

  const loadBudgetData = useCallback(async (groupId: string) => {
    setBudgetLoading(true);
    try {
      const [budgets, progress] = await Promise.all([
        getCategoryBudgets(groupId, currentMonth),
        getBudgetProgress(groupId, currentMonth),
      ]);
      setBudgets(budgets);
      setBudgetProgress(progress);
    } finally {
      setBudgetLoading(false);
    }
  }, [currentMonth]);

  const loadGroupData = useCallback(async (groupId: string, meId: string) => {
    const [groupData, expensesData] = await Promise.all([getGroup(groupId), getExpenses(groupId)]);
    setGroup(groupData);
    setExpenses(expensesData);
    setSelectedGroupIdState(groupId);
    const myMember = groupData.members.find((m) => m.id === meId);
    setCanManageAll(myMember?.role === "OWNER" || myMember?.role === "ADMIN");
    await loadBudgetData(groupId);
  }, [loadBudgetData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    Promise.all([getGroups(), getMe()])
      .then(async ([groupList, me]) => {
        setGroups(groupList);
        setCurrentUserId(me.id);
        if (groupList.length === 0) {
          router.replace("/groups/new");
          return;
        }
        const savedId = getSelectedGroupId();
        const initialGroupId =
          savedId && groupList.some((g) => g.id === savedId) ? savedId : groupList[0].id;
        setSelectedGroupId(initialGroupId);
        await loadGroupData(initialGroupId, me.id);
        setIsReady(true);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [loadGroupData, router]);

  const handleGroupChange = async (groupId: string) => {
    if (!groupId || groupId === selectedGroupId || !currentUserId) return;
    setIsSwitchingGroup(true);
    try {
      setSelectedGroupId(groupId);
      await loadGroupData(groupId, currentUserId);
      toast.success("グループを切り替えました");
    } catch {
      toast.error("グループ切り替えに失敗しました");
    } finally {
      setIsSwitchingGroup(false);
    }
  };

  if (!isReady || !group) {
    return <RouteLoading text="履歴を読み込み中..." withBottomNav />;
  }

  const grouped = groupByDate(expenses);
  const groupId = group.id;

  const handleDelete = async (expenseId: string) => {
    if (!confirm("この支出を削除しますか？")) return;
    try {
      await deleteExpense(groupId, expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      toast.success("削除しました");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "削除に失敗しました");
    }
  };

  const handleEdit = (expense: ExpenseRecord) => {
    const editable = canManageAll || currentUserId === expense.memberId;
    if (!editable) {
      toast.error("この支出を編集する権限がありません");
      return;
    }
    setEditing(expense);
    setEditMemo(expense.memo ?? "");
    setEditAmount(String(expense.amount));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const updated = await updateExpense(groupId, editing.id, {
        memo: editMemo,
        amount: Number(editAmount),
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditing(null);
      toast.success("更新しました");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "更新に失敗しました");
    }
  };

  const handleSaveBudgets = async (items: CategoryBudget[]) => {
    setBudgetSaving(true);
    try {
      const updated = await updateCategoryBudgets(groupId, {
        month: currentMonth,
        items,
      });
      setBudgets(updated);
      const progressData = await getBudgetProgress(groupId, currentMonth);
      setBudgetProgress(progressData);
      toast.success("予算を保存しました");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "予算の保存に失敗しました");
    } finally {
      setBudgetSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col w-full flex-1 pb-20">
        <p
          className="text-4xl text-[#2d2a26] dark:text-[#eae7e1] pb-4 text-center"
          style={{ fontFamily: "var(--font-dancing-script), cursive" }}
        >
          Share Wallet
        </p>

        <GroupSwitcher
          groups={groups}
          selectedGroupId={selectedGroupId}
          onChange={handleGroupChange}
          disabled={isSwitchingGroup}
          className="mb-4"
        />

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#c9a227] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="white" width={16} height={16}>
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1]">
            {group.name}
          </span>
        </div>

        <SummaryCard expenses={expenses} group={group} />

        <BudgetProgressPanel
          budgets={budgets}
          progress={budgetProgress}
          loading={budgetLoading}
          saving={budgetSaving}
          onSave={handleSaveBudgets}
        />

        <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mt-6 mb-2">
          支出履歴
        </h2>

        <div className="flex flex-col gap-1">
          {grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="sticky top-0 bg-[#faf8f5]/90 dark:bg-[#111110]/90 backdrop-blur-sm py-2 z-10">
                <span className="text-sm font-semibold text-[#7a756d] dark:text-[#9e9a93]">
                  {formatDate(items[0].date)}
                </span>
              </div>
              <div className="divide-y divide-[#f0ece6] dark:divide-[#262522]">
                {items.map((expense) => (
                  // OWNER/ADMIN は全件、自分の支出は本人が編集可能
                  // それ以外は編集ボタンを表示しない
                  // (API側でも権限チェックされる)
                  <ExpenseItem
                    key={expense.id}
                    expense={expense}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    canEdit={canManageAll || currentUserId === expense.memberId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {editing && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
            <div className="w-full bg-white dark:bg-[#1c1b19] rounded-t-2xl p-5">
              <h3 className="text-lg font-bold mb-3">支出を編集</h3>
              <label className="block mb-2 text-sm">メモ</label>
              <input
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                className="w-full h-10 rounded-lg px-3 border border-[#e5e0d8] dark:border-[#333230] mb-3"
              />
              <label className="block mb-2 text-sm">金額</label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full h-10 rounded-lg px-3 border border-[#e5e0d8] dark:border-[#333230] mb-4"
              />
              <button
                type="button"
                onClick={saveEdit}
                className="w-full h-11 rounded-lg bg-[#c9a227] text-white font-semibold mb-2"
              >
                変更を保存
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 h-10 rounded-lg border border-[#e5e0d8]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import CategoryIcon from "@/components/icons/CategoryIcon";
import GroupAvatar from "@/components/ui/GroupAvatar";
import type { Group, ExpenseRecord, CategoryName } from "@/types";
import {
  isAuthenticated,
  getSelectedGroupId,
  getGroup,
  getExpenses,
  getMe,
  updateExpense,
  deleteExpense,
  ApiClientError,
} from "@/lib/apiClient";

/** カテゴリの色マップ */
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
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canManageAll, setCanManageAll] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    const groupId = getSelectedGroupId();
    if (!groupId) {
      router.replace("/dashboard");
      return;
    }

    // API からグループ情報と支出一覧を並行取得
    Promise.all([getGroup(groupId), getExpenses(groupId), getMe()])
      .then(([groupData, expensesData, me]) => {
        setGroup(groupData);
        setExpenses(expensesData);
        setCurrentUserId(me.id);
        const myMember = groupData.members.find((m) => m.id === me.id);
        setCanManageAll(myMember?.role === "OWNER" || myMember?.role === "ADMIN");
        setIsReady(true);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [router]);

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

        <SummaryCard expenses={expenses} group={group} />

        <button
          type="button"
          onClick={() => router.push(`/groups/${groupId}/settlement`)}
          className="w-full mt-3 h-11 rounded-xl border border-[#c9a227] text-[#c9a227] font-semibold text-sm"
        >
          精算を確認 →
        </button>

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

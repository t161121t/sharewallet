"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import GroupSwitcher from "@/components/ui/GroupSwitcher";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import BudgetProgressPanel from "@/components/ui/BudgetProgressPanel";
import type { Group, CategoryBudget, BudgetProgressResponse } from "@/types";
import {
  ApiClientError,
  addMember,
  deleteGroup,
  getGroup,
  getGroups,
  setSelectedGroupId,
  getCategoryBudgets,
  getBudgetProgress,
  removeMember,
  updateCategoryBudgets,
  updateGroup,
} from "@/lib/apiClient";

export default function GroupSettingsPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#c9a227");
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgressResponse | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);

  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  };
  const currentMonth = getCurrentMonthKey();

  const loadBudgetData = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const [budgetsData, progressData] = await Promise.all([
        getCategoryBudgets(groupId, currentMonth),
        getBudgetProgress(groupId, currentMonth),
      ]);
      setBudgets(budgetsData);
      setBudgetProgress(progressData);
    } finally {
      setBudgetLoading(false);
    }
  }, [currentMonth, groupId]);

  useEffect(() => {
    Promise.all([getGroup(groupId), getGroups()])
      .then((g) => {
        const [groupData, groupList] = g;
        setGroup(groupData);
        setGroups(groupList);
        setName(groupData.name);
        setColor(groupData.color);
        return loadBudgetData();
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [groupId, loadBudgetData, router]);

  const refresh = async () => {
    const [g, list] = await Promise.all([getGroup(groupId), getGroups()]);
    setGroup(g);
    setGroups(list);
    setName(g.name);
    setColor(g.color);
    await loadBudgetData();
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateGroup(groupId, { name, color });
      toast.success("グループを更新しました");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("本当にグループを削除しますか？")) return;
    try {
      await deleteGroup(groupId);
      toast.success("グループを削除しました");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "削除に失敗しました");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await addMember(groupId, inviteEmail.trim());
      toast.success("メンバーを追加しました");
      setInviteEmail("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "メンバー追加に失敗しました");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("このメンバーを除外しますか？")) return;
    try {
      await removeMember(groupId, userId);
      toast.success("メンバーを除外しました");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "メンバー除外に失敗しました");
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

  const handleSwitchGroup = (nextGroupId: string) => {
    if (!nextGroupId || nextGroupId === groupId) return;
    setSelectedGroupId(nextGroupId);
    router.push(`/groups/${nextGroupId}/settings`);
  };

  if (!group) return <RouteLoading text="グループ設定を読み込み中..." withBottomNav />;

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col w-full gap-5 pb-20">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="self-start text-sm text-[#7a756d] dark:text-[#9e9a93] underline"
        >
          ← ダッシュボードに戻る
        </button>
        <h1 className="text-2xl font-bold text-[#2d2a26] dark:text-[#eae7e1]">
          グループ設定
        </h1>
        <GroupSwitcher
          groups={groups}
          selectedGroupId={groupId}
          onChange={handleSwitchGroup}
          className="mb-1"
        />
        <BudgetProgressPanel
          budgets={budgets}
          progress={budgetProgress}
          loading={budgetLoading}
          saving={budgetSaving}
          onSave={handleSaveBudgets}
        />
        <TextInput label="グループ名" value={name} onChange={setName} />
        <label className="w-full">
          <div className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-2">
            テーマカラー
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-12 w-24 rounded-lg"
          />
        </label>
        <PrimaryButton onClick={handleSave} loading={loading}>
          保存
        </PrimaryButton>

        <div className="border-t border-[#e5e0d8] dark:border-[#333230] pt-5">
          <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-2">
            メンバー招待
          </h2>
          <TextInput
            label="メールアドレス"
            type="email"
            value={inviteEmail}
            onChange={setInviteEmail}
            placeholder="example@mail.com"
          />
          <div className="mt-3">
            <PrimaryButton onClick={handleInvite}>追加する</PrimaryButton>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-2">
            メンバー一覧
          </h2>
          <div className="flex flex-col gap-2">
            {group.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl p-3 border border-[#e5e0d8] dark:border-[#333230]"
              >
                <span className="text-sm text-[#2d2a26] dark:text-[#eae7e1]">
                  {m.name} {m.role ? `(${m.role})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(m.id)}
                  className="text-xs text-red-500 underline"
                >
                  除外
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="w-full h-12 rounded-xl border border-red-400 text-red-500 font-semibold"
        >
          グループを削除
        </button>
      </PageTransition>
      <BottomNav />
    </ScreenContainer>
  );
}

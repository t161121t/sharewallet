"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import ColorPalette from "@/components/ui/ColorPalette";
import GroupAvatar from "@/components/ui/GroupAvatar";
import type { Group, GroupInvitation } from "@/types";
import {
  ApiClientError,
  addMember,
  createInvitation,
  deleteGroup,
  getGroup,
  getInvitations,
  removeMember,
  revokeInvitation,
  updateGroup,
} from "@/lib/apiClient";

export default function GroupSettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;

  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#c9a227");
  const [iconUrl, setIconUrl] = useState<string | undefined>(undefined);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGroup(groupId), getInvitations(groupId)])
      .then(([g, invs]) => {
        setGroup(g);
        setName(g.name);
        setColor(g.color);
        setIconUrl(g.iconUrl);
        setInvitations(invs);
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [groupId, router]);

  const refresh = async () => {
    const [g, invs] = await Promise.all([getGroup(groupId), getInvitations(groupId)]);
    setGroup(g);
    setName(g.name);
    setColor(g.color);
    setIconUrl(g.iconUrl);
    setInvitations(invs);
  };

  const handleCreateInvite = async () => {
    try {
      const inv = await createInvitation(groupId);
      setNewInviteUrl(inv.url);
      setInvitations((prev) => [inv, ...prev]);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "招待リンクの作成に失敗しました");
    }
  };

  const handleCopyInvite = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success("コピーしました"));
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm("この招待リンクを無効化しますか？")) return;
    try {
      await revokeInvitation(groupId, invitationId);
      toast.success("招待リンクを無効化しました");
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      if (newInviteUrl) {
        const revoked = invitations.find((inv) => inv.id === invitationId);
        if (revoked && newInviteUrl === revoked.url) setNewInviteUrl(null);
      }
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "招待リンクの無効化に失敗しました");
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("5MB以下の画像を選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        setIconUrl(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateGroup(groupId, { name, color, iconUrl: iconUrl ?? null });
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
        <TextInput label="グループ名" value={name} onChange={setName} />
        <div className="rounded-xl border border-[#e5e0d8] dark:border-[#333230] p-4">
          <p className="text-base font-medium text-[#4a4540] dark:text-[#c5c0b8] mb-3">
            グループアイコン
          </p>
          <div className="flex items-center gap-4">
            <GroupAvatar name={name || "グループ"} color={color} iconUrl={iconUrl} size={56} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#c9a227]"
              >
                画像を選択
              </button>
              {iconUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setIconUrl(undefined);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-[#e5e0d8] dark:border-[#333230]"
                >
                  削除
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
        </div>
        <ColorPalette value={color} onChange={setColor} />
        <PrimaryButton onClick={handleSave} loading={loading}>
          保存
        </PrimaryButton>

        <div className="border-t border-[#e5e0d8] dark:border-[#333230] pt-5 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1]">
            メンバー招待
          </h2>

          {/* 招待リンク */}
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#7a756d] dark:text-[#9e9a93]">
              招待リンクを作成してシェアすると、リンクを受け取った人がグループに参加できます。
            </p>
            <PrimaryButton onClick={handleCreateInvite}>
              招待リンクを作成
            </PrimaryButton>
            {newInviteUrl && (
              <div className="flex items-center gap-2 rounded-xl border border-[#e5e0d8] dark:border-[#333230] p-3">
                <span className="flex-1 text-xs text-[#4a4540] dark:text-[#c5c0b8] truncate">
                  {newInviteUrl}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyInvite(newInviteUrl)}
                  className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#c9a227]"
                >
                  コピー
                </button>
              </div>
            )}
            {invitations.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[#7a756d] dark:text-[#9e9a93]">
                  有効な招待リンク
                </p>
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl border border-[#e5e0d8] dark:border-[#333230] p-3 gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-[#4a4540] dark:text-[#c5c0b8] truncate">
                        {inv.url}
                      </span>
                      {inv.expiresAt && (
                        <span className="text-xs text-[#7a756d] dark:text-[#9e9a93]">
                          {new Date(inv.expiresAt).toLocaleDateString("ja-JP")} まで有効
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyInvite(inv.url)}
                        className="px-2 py-1 rounded-lg text-xs font-semibold border border-[#e5e0d8] dark:border-[#333230]"
                      >
                        コピー
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        className="text-xs text-red-500 underline"
                      >
                        無効化
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* メールアドレスで直接追加 */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-[#4a4540] dark:text-[#c5c0b8]">
              メールアドレスで直接追加
            </p>
            <TextInput
              label="メールアドレス"
              type="email"
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="example@mail.com"
            />
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

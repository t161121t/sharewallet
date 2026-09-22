"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import BottomNav from "@/components/layout/BottomNav";
import RouteLoading from "@/components/layout/RouteLoading";
import TextInput from "@/components/ui/TextInput";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { UserProfile } from "@/types";
import {
  isAuthenticated,
  getMe,
  updateMe,
  changePassword,
  logout,
  getCachedUser,
  ApiClientError,
} from "@/lib/apiClient";
import { MIN_PASSWORD_LENGTH, normalizePassword, isPasswordLongEnough } from "@/lib/validation";

const AVATAR_COLORS = [
  "#c9a227",
  "#3B82F6",
  "#EC4899",
  "#10B981",
  "#6366F1",
  "#F43F5E",
  "#8B5CF6",
  "#14B8A6",
  "#e67e22",
  "#64748B",
];

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#c9a227");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [userId, setUserId] = useState("u1");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    // まずキャッシュから即座に表示し、API からも取得して更新
    const cached = getCachedUser();
    if (cached) {
      setName(cached.name);
      setEmail(cached.email);
      setColor(cached.color);
      setAvatarUrl(cached.avatarUrl);
      setAvatarDirty(false);
      setUserId(cached.id);
    }

    getMe()
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
        setColor(user.color);
        setAvatarUrl(user.avatarUrl);
        setAvatarDirty(false);
        setUserId(user.id);
        setIsReady(true);
      })
      .catch(() => {
        // API 失敗してもキャッシュがあれば表示
        if (cached) {
          setIsReady(true);
        } else {
          router.replace("/login");
        }
      });

    // キャッシュがあれば先に表示
    if (cached) setIsReady(true);
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.85));
        setAvatarDirty(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(undefined);
    setAvatarDirty(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("名前を入力してください");
      return;
    }
    if (!email.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<UserProfile> = {
        id: userId,
        name: name.trim(),
        email: email.trim(),
        color,
      };
      if (avatarDirty) {
        payload.avatarUrl = avatarUrl;
      }
      await updateMe(payload);
      setAvatarDirty(false);
      toast.success("プロフィールを更新しました");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("更新に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      toast.error("現在のパスワードを入力してください");
      return;
    }
    // サーバー側もnormalizePassword(trim)後の値をハッシュ化・保存するため、
    // 検証・一致確認・送信を全て同じ値(正規化後)で揃える。confirmPassword側の
    // 比較を生の値のまま行うと、newPasswordだけtrimした値と食い違い、
    // 実際には一致しているのに「一致しません」と誤判定してしまう。
    const trimmedNewPassword = normalizePassword(newPassword);
    if (!isPasswordLongEnough(newPassword)) {
      toast.error(`新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
      return;
    }
    if (trimmedNewPassword !== normalizePassword(confirmPassword)) {
      toast.error("新しいパスワードが一致しません");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, trimmedNewPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("パスワードを変更しました");
    } catch (e) {
      if (e instanceof ApiClientError) {
        toast.error(e.message);
      } else {
        toast.error("パスワードの変更に失敗しました");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("ログアウトしました");
      router.push("/home");
    } catch {
      // 認証Cookieの破棄に失敗した場合、成功したと見せかけると
      // 認証状態が残ったまま「ログアウトできた」と誤認させてしまうため、
      // 失敗を明示して再試行を促す。
      toast.error("ログアウトに失敗しました。通信状態を確認して再度お試しください");
    }
  };

  if (!isReady) return <RouteLoading text="プロフィールを読み込み中..." withBottomNav />;

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col w-full flex-1 pb-24 gap-4">
        <header className="pt-1">
          <p
            className="text-3xl text-[#2d2a26] dark:text-[#eae7e1] text-center"
            style={{ fontFamily: "var(--font-dancing-script), cursive" }}
          >
            Share Wallet
          </p>
          <h1 className="text-xl font-bold text-[#2d2a26] dark:text-[#eae7e1] mt-3">
            マイページ
          </h1>
          <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] mt-1">
            プロフィール情報をここで管理できます
          </p>
        </header>

        <section className="w-full rounded-2xl border border-[#e5e0d8] dark:border-[#333230] bg-white/70 dark:bg-[#1a1917] p-5">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative w-30 h-30 rounded-full overflow-hidden shadow-lg group transition-transform duration-150 active:scale-95"
              style={{ backgroundColor: avatarUrl ? undefined : color }}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="アバター"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="120px"
                />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-5xl font-bold text-white">
                  {name ? name.charAt(0) : "?"}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <svg viewBox="0 0 24 24" fill="white" width={28} height={28}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </button>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <p className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] mt-3">
              {name || "未設定"}
            </p>
            <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] mt-1">
              {email || "未設定"}
            </p>
            <p className="text-xs text-[#9e9a93] dark:text-[#666360] mt-2">
              タップして写真を変更
            </p>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-sm text-red-500 dark:text-red-400 mt-3 underline hover:text-red-600"
              >
                写真を削除
              </button>
            )}
          </div>
        </section>

        <section className="w-full rounded-2xl border border-[#e5e0d8] dark:border-[#333230] bg-white/70 dark:bg-[#1a1917] p-5">
          <h2 className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-4">
            プロフィール編集
          </h2>
          <div className="flex flex-col gap-4 w-full">
            <TextInput label="名前" type="text" placeholder="名前を入力" value={name} onChange={setName} />
            <TextInput label="メールアドレス" type="email" placeholder="example@example.com" value={email} onChange={setEmail} />

            <div>
              <p className="text-sm font-semibold text-[#4a4540] dark:text-[#c5c0b8] mb-1">
                アイコンの色
              </p>
              <p className="text-xs text-[#9e9a93] dark:text-[#666360] mb-3">
                写真未設定時に表示される色です
              </p>
              <div className="grid grid-cols-5 gap-3">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={[
                      "w-11 h-11 rounded-full transition-all duration-150 justify-self-center",
                      color === c
                        ? "ring-3 ring-offset-2 ring-[#c9a227] scale-110"
                        : "hover:scale-105",
                    ].join(" ")}
                    style={{ backgroundColor: c }}
                    aria-label={`色 ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full rounded-2xl border border-[#e5e0d8] dark:border-[#333230] bg-white/70 dark:bg-[#1a1917] p-4">
          <PrimaryButton onClick={handleSave} loading={saving}>
            保存する
          </PrimaryButton>
        </section>

        <section className="w-full rounded-2xl border border-[#e5e0d8] dark:border-[#333230] bg-white/70 dark:bg-[#1a1917] p-5">
          <h2 className="text-base font-bold text-[#2d2a26] dark:text-[#eae7e1] mb-4">
            パスワード変更
          </h2>
          <div className="flex flex-col gap-4 w-full">
            <TextInput
              label="現在のパスワード"
              type="password"
              placeholder="現在のパスワードを入力"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={changingPassword}
            />
            <TextInput
              label="新しいパスワード"
              type="password"
              placeholder={`${MIN_PASSWORD_LENGTH}文字以上で入力`}
              value={newPassword}
              onChange={setNewPassword}
              disabled={changingPassword}
            />
            <TextInput
              label="新しいパスワード（確認）"
              type="password"
              placeholder="もう一度入力"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={changingPassword}
            />
          </div>
          <div className="mt-4">
            <PrimaryButton onClick={handleChangePassword} loading={changingPassword}>
              パスワードを変更する
            </PrimaryButton>
          </div>
        </section>

        <section className="w-full pt-1">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-12 rounded-xl border-2 border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 font-semibold text-base hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150 active:scale-[0.98]"
          >
            ログアウト
          </button>
        </section>
      </PageTransition>

      <BottomNav />
    </ScreenContainer>
  );
}

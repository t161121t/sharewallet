"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import ScreenContainer from "@/components/layout/ScreenContainer";
import PageTransition from "@/components/layout/PageTransition";
import GroupAvatar from "@/components/ui/GroupAvatar";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { InvitationInfo } from "@/types";
import { ApiClientError, acceptInvitation, getInvitationInfo, isAuthenticated } from "@/lib/apiClient";

type PageState = "loading" | "valid" | "invalid" | "expired" | "joined";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [state, setState] = useState<PageState>("loading");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    getInvitationInfo(token)
      .then((data) => {
        setInfo(data);
        setState("valid");
      })
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 410) {
          setState("expired");
        } else {
          setState("invalid");
        }
      });
  }, [token]);

  const handleJoin = async () => {
    if (!isAuthenticated()) {
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }
    setJoining(true);
    try {
      const result = await acceptInvitation(token);
      toast.success(`「${result.groupName}」に参加しました`);
      router.push("/dashboard");
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        router.push(`/login?redirect=/invite/${token}`);
      } else {
        toast.error(e instanceof ApiClientError ? e.message : "参加に失敗しました");
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <ScreenContainer>
      <PageTransition className="flex flex-col items-center w-full gap-6 py-12 px-4">
        {state === "loading" && (
          <p className="text-[#7a756d] dark:text-[#9e9a93]">読み込み中...</p>
        )}

        {(state === "invalid" || state === "expired") && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-4xl">{state === "expired" ? "⏰" : "🚫"}</div>
            <h1 className="text-xl font-bold text-[#2d2a26] dark:text-[#eae7e1]">
              {state === "expired"
                ? "招待リンクの有効期限が切れています"
                : "無効な招待リンクです"}
            </h1>
            <p className="text-sm text-[#7a756d] dark:text-[#9e9a93]">
              グループのオーナーに新しい招待リンクを発行してもらってください。
            </p>
            <Link
              href="/dashboard"
              className="text-sm underline text-[#c9a227]"
            >
              ダッシュボードへ
            </Link>
          </div>
        )}

        {state === "valid" && info && (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            <GroupAvatar
              name={info.groupName}
              color={info.groupColor}
              iconUrl={info.groupIconUrl}
              size={80}
            />
            <div className="text-center">
              <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] mb-1">
                グループへの招待
              </p>
              <h1 className="text-2xl font-bold text-[#2d2a26] dark:text-[#eae7e1]">
                {info.groupName}
              </h1>
              <p className="text-sm text-[#7a756d] dark:text-[#9e9a93] mt-1">
                メンバー {info.memberCount} 人 ・ {info.createdByName} が招待
              </p>
              {info.expiresAt && (
                <p className="text-xs text-[#7a756d] dark:text-[#9e9a93] mt-1">
                  {new Date(info.expiresAt).toLocaleDateString("ja-JP")} まで有効
                </p>
              )}
            </div>

            <div className="w-full flex flex-col gap-3">
              {isAuthenticated() ? (
                <PrimaryButton onClick={handleJoin} loading={joining}>
                  このグループに参加する
                </PrimaryButton>
              ) : (
                <>
                  <PrimaryButton onClick={handleJoin} loading={joining}>
                    ログインして参加する
                  </PrimaryButton>
                  <p className="text-center text-xs text-[#7a756d] dark:text-[#9e9a93]">
                    アカウントをお持ちでない方は{" "}
                    <Link
                      href={`/register?redirect=/invite/${token}`}
                      className="underline text-[#c9a227]"
                    >
                      新規登録
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </PageTransition>
    </ScreenContainer>
  );
}

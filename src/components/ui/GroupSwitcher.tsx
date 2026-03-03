"use client";

import Link from "next/link";
import Image from "next/image";
import type { Group } from "@/types";

type GroupSwitcherProps = {
  groups: Group[];
  selectedGroupId: string | null;
  onChange: (groupId: string) => void;
  disabled?: boolean;
  className?: string;
};

export default function GroupSwitcher({
  groups,
  selectedGroupId,
  onChange,
  disabled = false,
  className = "",
}: GroupSwitcherProps) {
  const selectedGroup =
    groups.find((g) => g.id === selectedGroupId) ?? (groups.length > 0 ? groups[0] : null);

  return (
    <div
      className={[
        "w-full rounded-2xl border border-[#e8e1d6] dark:border-[#3a3733]",
        "bg-white/90 dark:bg-[#1f1f1f]/80 p-3",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: selectedGroup?.color ?? "#c9a227" }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#3d3a36] dark:text-[#d5d0c8] truncate">
            グループ切り替え
          </p>
        </div>
        <span className="text-xs text-[#7a756d] dark:text-[#9e9a93]">
          {groups.length}グループ
        </span>
      </div>

      <div className="flex justify-end mb-2">
        <Link
          href="/groups/new"
          className="inline-flex items-center rounded-md border border-[#decf9a] dark:border-[#5a4d22] bg-[#fff6dc] dark:bg-[#3a3219] px-2 py-1 text-xs font-semibold text-[#8b6e12] dark:text-[#f1df9b]"
        >
          + 新規作成
        </Link>
      </div>

      <div className="relative">
        <select
          value={selectedGroup?.id ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || groups.length === 0}
          className={[
            "w-full h-11 rounded-xl px-3 pr-10 appearance-none",
            "bg-[#f8f4ee] dark:bg-[#262522]",
            "border border-[#e5e0d8] dark:border-[#333230]",
            "text-[#2d2a26] dark:text-[#eae7e1]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "outline-none focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]",
          ].join(" ")}
        >
          {groups.length === 0 ? (
            <option value="">グループがありません</option>
          ) : (
            groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))
          )}
        </select>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          width={16}
          height={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a756d] dark:text-[#9e9a93] pointer-events-none"
          aria-hidden
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </div>

      {selectedGroup && (
        <div className="mt-3 rounded-xl bg-[#f8f4ee] dark:bg-[#262522] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#2d2a26] dark:text-[#eae7e1] truncate">
                {selectedGroup.name}
              </p>
              <p className="text-xs text-[#7a756d] dark:text-[#9e9a93] mt-0.5">
                {selectedGroup.members.length}人のメンバー
              </p>
            </div>
            <Link
              href={`/groups/${selectedGroup.id}/settings`}
              className="text-xs text-[#7a756d] dark:text-[#9e9a93] underline shrink-0"
            >
              設定
            </Link>
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            {selectedGroup.members.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className="relative w-7 h-7 rounded-full overflow-hidden border border-white/80 dark:border-[#1f1f1f]"
                style={{ backgroundColor: member.color }}
                title={member.name}
              >
                {member.avatarUrl ? (
                  <Image
                    src={member.avatarUrl}
                    alt={member.name}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="28px"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
                    {member.name.charAt(0)}
                  </span>
                )}
              </div>
            ))}
            {selectedGroup.members.length > 5 && (
              <span className="text-xs text-[#7a756d] dark:text-[#9e9a93] ml-1">
                +{selectedGroup.members.length - 5}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

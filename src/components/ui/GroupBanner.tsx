"use client";

import type { Group } from "@/types";
import MemberAvatar from "@/components/ui/MemberAvatar";
import GroupAvatar from "@/components/ui/GroupAvatar";

type GroupBannerProps = {
  group: Group;
};

function lightBg(hex: string, opacity = 0.10) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export default function GroupBanner({ group }: GroupBannerProps) {
  const c = group.color;

  return (
    <div
      className="w-full rounded-2xl px-5 py-4 border"
      style={{
        backgroundColor: lightBg(c, 0.08),
        borderColor: lightBg(c, 0.20),
      }}
    >
      <div className="flex items-center gap-3">
        <GroupAvatar name={group.name} color={c} iconUrl={group.iconUrl} size={40} className="rounded-full" />
        <div className="flex flex-col min-w-0">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: c }}
          >
            グループ
          </span>
          <span className="text-lg font-bold text-[#2d2a26] dark:text-[#eae7e1] truncate">
            {group.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <div className="flex -space-x-2">
          {group.members.map((member) => (
            <MemberAvatar
              key={member.id}
              name={member.name}
              color={member.color}
              avatarUrl={member.avatarUrl}
              size={32}
              className="border-2"
              style={{ borderColor: lightBg(c, 0.08) }}
            />
          ))}
        </div>
        <span className="text-sm text-[#7a756d] dark:text-[#9e9a93] ml-1">
          {group.members.length}人のメンバー
        </span>
      </div>
    </div>
  );
}

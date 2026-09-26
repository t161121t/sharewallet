"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Tabbar, TabbarLink } from "konsta/react";
import { Home, SquarePlus, ScrollText, CircleUserRound } from "lucide-react";
import MemberAvatar from "@/components/ui/MemberAvatar";
import { getCachedUser } from "@/lib/apiClient";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const ICON_SIZE = 24;

const STATIC_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "ホーム",
    icon: (active) => (
      <Home size={ICON_SIZE} strokeWidth={active ? 2.25 : 1.75} fill={active ? "currentColor" : "none"} />
    ),
  },
  {
    href: "/expense",
    label: "入力",
    icon: (active) => <SquarePlus size={ICON_SIZE} strokeWidth={active ? 2.25 : 1.75} />,
  },
  {
    href: "/expense/history",
    label: "詳細",
    icon: (active) => <ScrollText size={ICON_SIZE} strokeWidth={active ? 2.25 : 1.75} />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; color: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) setUser(cached);

    const onStorage = () => {
      const updated = getCachedUser();
      if (updated) setUser(updated);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const cached = getCachedUser();
    if (cached) setUser(cached);
  }, [pathname]);

  const profileActive = pathname === "/profile";
  const profileIcon = user ? (
    <MemberAvatar
      name={user.name}
      color={user.color}
      avatarUrl={user.avatarUrl}
      size={24}
      className={profileActive ? "ring-2 ring-primary" : "ring-1 ring-black/10 dark:ring-white/20"}
    />
  ) : (
    <CircleUserRound size={ICON_SIZE} strokeWidth={profileActive ? 2.25 : 1.75} />
  );

  return (
    <Tabbar
      labels
      icons
      className="fixed bottom-0 left-0 right-0 z-50"
      innerClassName="max-w-lg mx-auto w-full"
    >
      {STATIC_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <TabbarLink
            key={item.href}
            component={Link}
            linkProps={{ href: item.href }}
            active={active}
            icon={item.icon(active)}
            label={item.label}
          />
        );
      })}
      <TabbarLink
        component={Link}
        linkProps={{ href: "/profile" }}
        active={profileActive}
        icon={profileIcon}
        label="マイページ"
      />
    </Tabbar>
  );
}

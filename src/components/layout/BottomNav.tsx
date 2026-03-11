"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MemberAvatar from "@/components/ui/MemberAvatar";
import { getCachedUser } from "@/lib/apiClient";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const STATIC_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "ホーム",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24}>
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    href: "/expense",
    label: "入力",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24}>
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
    ),
  },
  {
    href: "/expense/history",
    label: "詳細",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24}>
        <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
      </svg>
    ),
  },
];

const PROFILE_FALLBACK_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

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

  const profileIcon = user ? (
    <MemberAvatar
      name={user.name}
      color={user.color}
      avatarUrl={user.avatarUrl}
      size={24}
      className="ring-1 ring-white/30 dark:ring-black/30"
    />
  ) : (
    PROFILE_FALLBACK_ICON
  );

  const allItems: NavItem[] = [
    ...STATIC_ITEMS,
    { href: "/profile", label: "マイページ", icon: profileIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1c1b19]/95 backdrop-blur-md border-t border-[#e5e0d8] dark:border-[#333230] z-50">
      <div className="max-w-lg mx-auto flex">
        {allItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex-1 flex flex-col items-center gap-1 py-3 transition-colors duration-150",
                isActive
                  ? "text-[#c9a227]"
                  : "text-[#b5b0a8] dark:text-[#666360] hover:text-[#7a756d] dark:hover:text-[#9e9a93]",
              ].join(" ")}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  role?: string;
};

type MenuItem = {
  label: string;
  path: string;
  tone: "gold" | "dark" | "green" | "blue" | "red";
};

export default function Sidebar({ role = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const normalizedRole = role.trim().toLowerCase();

  const menuItems = useMemo<MenuItem[]>(() => {
    const base: MenuItem[] = [
      { label: "ホーム", path: "/home", tone: "gold" },
      { label: "プロフィール", path: "/profile", tone: "blue" },
    ];

    if (normalizedRole === "manager") {
      return [
        ...base,
        { label: "組織マップ", path: "/org-map", tone: "green" },
        { label: "フィードバック", path: "/feedback", tone: "dark" },
      ];
    }

    if (normalizedRole === "admin") {
      return [
        ...base,
        { label: "組織マップ", path: "/org-map", tone: "green" },
        { label: "フィードバック", path: "/feedback", tone: "dark" },
        { label: "ユーザー管理", path: "/admin/users", tone: "blue" },
        { label: "相性自動生成", path: "/admin/compatibility", tone: "red" },
      ];
    }

    return base;
  }, [normalizedRole]);

  const toneClassMap: Record<MenuItem["tone"], string> = {
    gold: "p4g-button-gold",
    dark: "p4g-button-dark",
    green: "p4g-button-green",
    blue: "p4g-button-blue",
    red: "p4g-button-red",
  };

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-5">
        <div className="p4g-card p-4">
          <div className="mb-4 p4g-section-title">メニュー</div>

          <div className="grid gap-3">
            {menuItems.map((item) => {
              const active =
                pathname === item.path ||
                (item.path === "/profile" && pathname.startsWith("/profile"));

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`p4g-button text-left ${
                    active ? "p4g-button-dark" : toneClassMap[item.tone]
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
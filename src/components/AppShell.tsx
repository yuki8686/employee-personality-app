"use client";

import { ReactNode, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  title: string;
  role?: string;
  children: ReactNode;
};

export default function AppShell({ title, role, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = useMemo(() => {
    const normalizedRole = (role || "").trim().toLowerCase();

    const base = [
      { label: "ホーム", path: "/home" },
      { label: "プロフィール", path: "/profile" },
    ];

    if (normalizedRole === "admin") {
      return [
        ...base,
        { label: "組織マップ", path: "/org-map" },
        { label: "フィードバック", path: "/feedback" },
      ];
    }

    if (normalizedRole === "manager") {
      return [
        ...base,
        { label: "組織マップ", path: "/org-map" },
        { label: "フィードバック", path: "/feedback" },
      ];
    }

    return base;
  }, [role]);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="p4g-panel overflow-hidden">
          <header className="border-b-2 border-black bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-100 px-5 py-4 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-gray-700">
                  Employee Personality App
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
                {role && (
                  <div className="mt-2">
                    <span className="p4g-chip">権限: {role}</span>
                  </div>
                )}
              </div>

              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => {
                  const active =
                    pathname === item.path ||
                    (item.path === "/profile" && pathname.startsWith("/profile"));

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => router.push(item.path)}
                      className={`p4g-button ${
                        active ? "p4g-button-yellow" : "p4g-button-dark"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          <section className="px-5 py-5 md:px-8 md:py-8">{children}</section>
        </div>
      </div>
    </main>
  );
}
"use client";

import { ReactNode, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  title: string;
  role?: string;
  children: ReactNode;
};

type NavItem = {
  label: string;
  shortLabel: string;
  path: string;
};

export default function AppShell({ title, role, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const normalizedRole = (role || "").trim().toLowerCase();

  const navItems = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { label: "ホーム", shortLabel: "ホーム", path: "/home" },
      { label: "プロフィール", shortLabel: "プロフ", path: "/profile" },
    ];

    if (normalizedRole === "admin" || normalizedRole === "manager") {
      return [
        ...base,
        { label: "組織マップ", shortLabel: "マップ", path: "/org-map" },
        { label: "フィードバック", shortLabel: "入力", path: "/feedback" },
      ];
    }

    return base;
  }, [normalizedRole]);

  return (
    <main className="p4g-shell px-0 py-0 md:px-4 md:py-4">
      <div className="mx-auto max-w-7xl">
        <div className="p4g-frame">
          <header className="p4g-topband px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="p4g-brand-ribbon">
                  <span>Regal Cast Database</span>
                </div>

                <div>
                  <p className="p4g-brand-sub">PERSONALITY DIAGNOSTIC SYSTEM</p>
                  <h1 className="mt-1 text-[2rem] font-black tracking-tight text-white sm:text-[3.2rem]">
                    {title}
                  </h1>
                  {role && (
                    <div className="mt-3">
                      <span className="p4g-pill">ROLE: {role}</span>
                    </div>
                  )}
                </div>
              </div>

              <nav className="hidden flex-wrap gap-3 md:flex">
                {navItems.map((item) => {
                  const active =
                    pathname === item.path ||
                    (item.path === "/profile" && pathname.startsWith("/profile"));

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => router.push(item.path)}
                      className={`p4g-nav-btn ${
                        active ? "p4g-nav-btn-active" : "p4g-nav-btn-idle"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          <section className="p4g-content-padding px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-5">
            {children}
          </section>
        </div>
      </div>

      <div className="md:hidden">
        <div className="p4g-mobile-nav">
          <div className="p4g-mobile-nav-grid">
            {navItems.map((item) => {
              const active =
                pathname === item.path ||
                (item.path === "/profile" && pathname.startsWith("/profile"));

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`p4g-mobile-nav-btn ${
                    active ? "p4g-mobile-nav-btn-active" : ""
                  }`}
                >
                  {item.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
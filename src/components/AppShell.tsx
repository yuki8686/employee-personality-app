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

    if (normalizedRole === "admin" || normalizedRole === "manager") {
      return [
        ...base,
        { label: "組織マップ", path: "/org-map" },
        { label: "フィードバック", path: "/feedback" },
      ];
    }

    return base;
  }, [role]);

  return (
    <main className="min-h-screen bg-[#f4eed0] p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border-[3px] border-black bg-[#f7f2dc] shadow-[0_8px_0_rgba(0,0,0,0.12)]">
          <header className="border-b-[3px] border-black bg-gradient-to-r from-[#f6d313] via-[#f3de68] to-[#efe7b3] px-4 py-5 sm:px-6 md:px-8">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-gray-700 sm:text-base">
                  Employee Personality App
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                  {title}
                </h1>
                {role && (
                  <div className="mt-3">
                    <span className="inline-block rounded-full border-[3px] border-black bg-white px-4 py-2 text-sm font-extrabold shadow-[0_4px_0_rgba(0,0,0,0.12)]">
                      権限: {role}
                    </span>
                  </div>
                )}
              </div>

              <nav className="flex flex-wrap gap-3">
                {navItems.map((item) => {
                  const active =
                    pathname === item.path ||
                    (item.path === "/profile" && pathname.startsWith("/profile"));

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => router.push(item.path)}
                      className={`min-w-[110px] rounded-[18px] border-[3px] border-black px-5 py-3 text-lg font-black shadow-[0_4px_0_rgba(0,0,0,0.14)] transition ${
                        active
                          ? "bg-[#111111] text-white"
                          : "bg-gradient-to-b from-[#ffe75b] to-[#f4cb14] text-black"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </header>

          <section className="bg-[#f7f2dc] px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
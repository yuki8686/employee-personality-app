"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBottomNavItems, isActivePath } from "@/lib/navigation/navConfig";

type P4BottomNavProps = {
  role?: string;
};

export default function P4BottomNav({ role }: P4BottomNavProps) {
  const pathname = usePathname();
  const items = getBottomNavItems(role);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t-[3px] border-black bg-[linear-gradient(180deg,#1a1a1a_0%,#0d0d0d_100%)] shadow-[0_-5px_0_#000] md:hidden">
      <div className="absolute left-0 top-0 h-2 w-full bg-[#f3c400]" />

      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1.5 px-2.5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2.5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-[58px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-[16px] border-[3px] border-black px-1.5 py-2 text-center transition-all duration-200 ${
                active
                  ? "bg-[#f3c400] text-black shadow-[0_5px_0_#000]"
                  : "bg-[#111111] text-white shadow-[0_4px_0_#000] active:translate-y-[1px]"
              }`}
            >
              <span
                className={`absolute left-0 top-0 h-full transition-all duration-200 ${
                  active
                    ? "w-2.5 bg-white/20"
                    : "w-1.5 bg-white/10 group-active:w-2.5"
                }`}
              />
              <span className="relative z-10 shrink-0 text-[15px] leading-none">
                {item.icon}
              </span>
              <span className="relative z-10 mt-1 whitespace-nowrap text-[10px] font-black tracking-[0.04em]">
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
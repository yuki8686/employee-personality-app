"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getPageNavItems,
  isActivePath,
  type AppNavItem,
} from "@/lib/navigation/navConfig";

type P4PageNavProps = {
  role?: string;
};

export default function P4PageNav({ role }: P4PageNavProps) {
  const pathname = usePathname();
  const items = getPageNavItems(role);

  return (
    <nav className="flex w-full flex-wrap gap-1.5 md:gap-2">
      {items.map((item: AppNavItem) => {
        const active = isActivePath(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative inline-flex min-h-[46px] flex-none items-center gap-1.5 overflow-hidden rounded-[14px] border-[3px] border-black px-3 py-2 font-black transition-all duration-200 md:min-h-[52px] md:gap-2 md:rounded-[16px] md:px-4 ${
              active
                ? "bg-[#f3c400] text-black shadow-[0_5px_0_#000] md:shadow-[0_6px_0_#000]"
                : "bg-[#111111] text-white hover:-translate-y-0.5 hover:bg-[#1d1d1d] hover:shadow-[0_7px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] md:hover:shadow-[0_8px_0_#000]"
            }`}
          >
            <span
              className={`absolute inset-y-0 left-0 transition-all duration-200 ${
                active
                  ? "w-2.5 bg-white/20 md:w-3"
                  : "w-1.5 bg-white/10 group-hover:w-3 md:w-2 md:group-hover:w-4"
              }`}
            />
            <span className="relative z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/30 bg-white/10 text-[10px] md:h-6 md:w-6 md:text-xs">
              {item.icon}
            </span>
            <span className="relative z-10 whitespace-nowrap text-[12px] leading-none sm:text-[13px] md:text-sm">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
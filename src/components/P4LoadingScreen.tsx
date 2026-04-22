"use client";

type P4LoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export default function P4LoadingScreen({
  title = "NOW LOADING",
  subtitle = "データを読み込み中...",
}: P4LoadingScreenProps) {
  return (
    <main className="p4g-shell flex min-h-screen items-center justify-center px-4 py-6 text-white">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border-[4px] border-black bg-[#171717] shadow-[0_12px_0_#000]">
        <div className="absolute left-0 top-0 h-3 w-full bg-[#f3c400]" />
        <div className="absolute right-5 top-5 h-4 w-4 rotate-45 border-[2px] border-black bg-[#ffe46a]" />
        <div className="relative p-6 pt-8 md:p-8 md:pt-10">
          <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1 text-xs font-black tracking-[0.18em] text-black shadow-[0_4px_0_#000]">
            SYSTEM
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-[0.04em] md:text-4xl">
            {title}
          </h1>

          <p className="mt-3 text-sm font-bold text-white/80 md:text-base">
            {subtitle}
          </p>

          <div className="mt-6 grid gap-3">
            <div className="h-4 overflow-hidden rounded-full border-[3px] border-black bg-[#111111]">
              <div className="h-full w-[42%] animate-pulse bg-[linear-gradient(90deg,#fff27a_0%,#f3c400_100%)]" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000]">
                <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
                <div className="mt-3 h-6 w-24 animate-pulse rounded bg-white/15" />
              </div>

              <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000]">
                <div className="h-3 w-16 animate-pulse rounded bg-white/20" />
                <div className="mt-3 h-6 w-20 animate-pulse rounded bg-white/15" />
              </div>

              <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000]">
                <div className="h-3 w-24 animate-pulse rounded bg-white/20" />
                <div className="mt-3 h-6 w-28 animate-pulse rounded bg-white/15" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full border-[2px] border-black bg-[#f3c400]" />
            <span className="h-3 w-3 animate-pulse rounded-full border-[2px] border-black bg-[#ffe46a]" />
            <span className="h-3 w-3 animate-pulse rounded-full border-[2px] border-black bg-white" />
          </div>
        </div>
      </div>
    </main>
  );
}
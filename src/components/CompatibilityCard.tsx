"use client";

type Props = {
  name?: string;
  mbti?: string;
  businessCode?: string;
  type?: "good" | "conflict";
  hiddenName?: boolean;
  score?: number;
};

export default function CompatibilityCard({
  name = "不明",
  mbti = "-",
  businessCode = "-",
  type = "good",
  hiddenName = false,
  score,
}: Props) {
  const isGood = type === "good";

  return (
    <div
      className={`p4g-match-card ${
        isGood ? "p4g-match-card-good" : "p4g-match-card-bad"
      }`}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-black">
            {hiddenName ? "非表示" : name}
          </p>
          <p className="mt-1 text-sm font-black text-[#4d4d4d] sm:text-base">
            {mbti} × {businessCode}
          </p>

          {typeof score === "number" && (
            <div className="mt-3 w-full max-w-[220px]">
              <div className="mb-2 flex items-center justify-between text-xs font-black text-[#6a624f]">
                <span>相性スコア</span>
                <span>{score}</span>
              </div>
              <div className="p4g-list-bar">
                <div
                  className="p4g-list-bar-fill"
                  style={{ width: `${Math.max(0, Math.min(100, score * 5))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <span
          className={`shrink-0 rounded-[12px] border-[2px] border-black px-3 py-1 text-xs font-black ${
            isGood
              ? "bg-[#61c45f] text-white"
              : "bg-[#d84a4a] text-white"
          }`}
        >
          {isGood ? "良好" : "注意"}
        </span>
      </div>
    </div>
  );
}
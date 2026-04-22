"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";
import {
  buildCompatibilityGuide,
  buildDiagnosisCommentary,
} from "@/lib/diagnosis/commentary";
import {
  buildBusinessBlindSpot,
  buildBusinessValueDriver,
  buildBusinessWorkStyle,
  buildMbtiBlindSpot,
  buildMbtiCore,
  buildMbtiEmotion,
  generateInsights,
} from "@/lib/diagnosis/insights";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  status?: string;
};

type AxisScore = {
  leftKey?: string;
  rightKey?: string;
  leftScore?: number;
  rightScore?: number;
  leftRatio?: number;
  rightRatio?: number;
  difference?: number;
  dominant?: string;
  isBorderline?: boolean;
  answeredCount?: number;
  neutralCount?: number;
  neutralRate?: number;
  totalWeight?: number;
  signedScore?: number;
};

type ConfidenceDetail = {
  reverseMismatchCount?: number;
  consistencyMismatchCount?: number;
  neutralAnswerCount?: number;
  unansweredCount?: number;
};

type CurrentDiagnosticData = {
  userId?: string;
  mbti?: {
    type?: string;
    typeName?: string;
    confidence?: number;
    confidenceRank?: string;
    confidenceSummary?: string;
    confidenceDetail?: ConfidenceDetail;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    confidenceRank?: string;
    confidenceSummary?: string;
    confidenceDetail?: ConfidenceDetail;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  diagnosedAt?: string;
  updatedAt?: string;
};

function formatDisplayDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(value?: number): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

function formatAxisLabel(axis: string) {
  if (axis === "EI") return "E / I";
  if (axis === "SN") return "S / N";
  if (axis === "TF") return "T / F";
  if (axis === "JP") return "J / P";
  if (axis === "MP") return "Manager / Player";
  if (axis === "QR") return "Quest / Reward";
  if (axis === "VT") return "Value / Terms";
  if (axis === "CS") return "Challenge / Safety";
  return axis;
}

function getConfidenceRank(score?: number) {
  if (typeof score !== "number") return "-";
  if (score >= 90) return "高";
  if (score >= 75) return "やや高";
  if (score >= 60) return "中";
  if (score >= 40) return "やや低";
  return "低";
}

function PanelFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[20px] border-[3px] border-black bg-[#171717] shadow-[0_6px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_10px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-2 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3 w-3 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-3.5 pt-5 md:p-5 md:pt-7">
        {title && (
          <div className="mb-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.08em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:tracking-[0.12em] md:shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {label}
      </p>
      <div className="mt-1.5 md:mt-2">{value}</div>
    </div>
  );
}

function InsightCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {title}
      </p>
      <p className="mt-2 text-[13px] font-bold leading-6 text-white/85 md:mt-3 md:text-sm md:leading-7">
        {body}
      </p>
    </div>
  );
}

function DiagnosticQualityCard({
  title,
  score,
  rank,
  summary,
  detail,
}: {
  title: string;
  score?: number;
  rank?: string;
  summary?: string;
  detail?: ConfidenceDetail;
}) {
  const displayRank =
    typeof rank === "string" && rank.trim() !== "" ? rank : getConfidenceRank(score);

  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">{title}</p>

      <div className="mt-3 grid gap-3 md:mt-4 md:grid-cols-[0.8fr_1.2fr] md:gap-4">
        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
            信頼度
          </p>
          <p className="mt-1.5 text-[30px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-4xl">
            {typeof score === "number" ? `${score}%` : "-"}
          </p>
          <p className="mt-1.5 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
            ランク: {displayRank || "-"}
          </p>
        </div>

        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
            診断品質コメント
          </p>
          <p className="mt-2 text-[13px] font-bold leading-6 text-white/85 md:mt-3 md:text-sm md:leading-7">
            {summary || "診断品質コメントはまだありません。"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 md:mt-4 md:grid-cols-4">
        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.1em] text-white/55 md:text-xs md:tracking-[0.12em]">
            Reverse矛盾
          </p>
          <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
            {detail?.reverseMismatchCount ?? 0}
          </p>
        </div>

        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.1em] text-white/55 md:text-xs md:tracking-[0.12em]">
            Consistency矛盾
          </p>
          <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
            {detail?.consistencyMismatchCount ?? 0}
          </p>
        </div>

        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.1em] text-white/55 md:text-xs md:tracking-[0.12em]">
            中立回答
          </p>
          <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
            {detail?.neutralAnswerCount ?? 0}
          </p>
        </div>

        <div className="rounded-[14px] border-[3px] border-black bg-[#171717] p-3 md:rounded-[18px] md:p-4">
          <p className="text-[10px] font-black tracking-[0.1em] text-white/55 md:text-xs md:tracking-[0.12em]">
            未回答
          </p>
          <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
            {detail?.unansweredCount ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}

function AxisPanel({
  title,
  axes,
}: {
  title: string;
  axes?: Record<string, AxisScore>;
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">{title}</p>

      <div className="mt-3 grid gap-3 md:mt-4 md:gap-4">
        {axes && Object.keys(axes).length > 0 ? (
          Object.entries(axes).map(([axis, score]) => {
            const leftRatio =
              typeof score.leftRatio === "number" ? score.leftRatio : 0.5;
            const rightRatio =
              typeof score.rightRatio === "number" ? score.rightRatio : 0.5;

            const leftKey = score.leftKey || "-";
            const rightKey = score.rightKey || "-";
            const dominant = score.dominant || "-";

            return (
              <div
                key={axis}
                className="rounded-[14px] border-[3px] border-black bg-[#1a1a1a] p-3 shadow-[0_4px_0_#000] md:rounded-[18px] md:p-4 md:shadow-[0_6px_0_#000]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-black md:text-sm">
                    {formatAxisLabel(axis)}
                  </p>
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    {dominant}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-white/70 md:mt-3 md:text-xs">
                  <span>{leftKey}</span>
                  <span>{rightKey}</span>
                </div>

                <div className="mt-1 h-3 overflow-hidden rounded-full border-[3px] border-black bg-[#242424] md:h-4">
                  <div className="flex h-full w-full">
                    <div
                      className="bg-[linear-gradient(90deg,#fff27a_0%,#f3c400_100%)]"
                      style={{ width: `${Math.round(leftRatio * 100)}%` }}
                    />
                    <div
                      className="bg-[linear-gradient(90deg,#8f8f8f_0%,#d9d9d9_100%)]"
                      style={{ width: `${Math.round(rightRatio * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-white/70 md:text-xs">
                  <span>{formatPercent(leftRatio)}</span>
                  <span>{formatPercent(rightRatio)}</span>
                </div>

                <p className="mt-2 text-[11px] font-bold leading-5 text-white/65 md:mt-3 md:text-xs">
                  差分: {typeof score.difference === "number" ? score.difference : "-"}
                  {score.isBorderline ? " / 境界軸" : ""}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-[13px] font-bold leading-6 text-white/80 md:text-sm">
            軸データがありません。
          </p>
        )}
      </div>
    </div>
  );
}

export default function DiagnosisResultPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diagnostic, setDiagnostic] = useState<CurrentDiagnosticData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const [userSnap, diagnosticSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "diagnostics_current", user.uid)),
        ]);

        if (!userSnap.exists()) {
          router.push("/login");
          return;
        }

        setProfile({
          ...(userSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        });

        if (!diagnosticSnap.exists()) {
          setError("診断結果が見つかりません。");
          setDiagnostic(null);
          return;
        }

        setDiagnostic(diagnosticSnap.data() as CurrentDiagnosticData);
      } catch (e) {
        console.error("result 読み込み失敗:", e);
        setError("診断結果の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const normalizedRole = (profile?.role || "").trim().toLowerCase();

  const mbtiType = diagnostic?.mbti?.type || "-";
  const mbtiTypeName = diagnostic?.mbti?.typeName || getMbtiTypeName(mbtiType);
  const businessType = diagnostic?.businessPersonality?.primaryType || "-";
  const businessTypeName =
    diagnostic?.businessPersonality?.typeName || getBusinessTypeName(businessType);

  const mbtiConfidence = diagnostic?.mbti?.confidence;
  const businessConfidence = diagnostic?.businessPersonality?.confidence;

  const mbtiConfidenceRank =
    diagnostic?.mbti?.confidenceRank || getConfidenceRank(mbtiConfidence);
  const businessConfidenceRank =
    diagnostic?.businessPersonality?.confidenceRank ||
    getConfidenceRank(businessConfidence);

  const mbtiConfidenceSummary = diagnostic?.mbti?.confidenceSummary;
  const businessConfidenceSummary = diagnostic?.businessPersonality?.confidenceSummary;

  const mbtiConfidenceDetail = diagnostic?.mbti?.confidenceDetail;
  const businessConfidenceDetail = diagnostic?.businessPersonality?.confidenceDetail;

  const mbtiAmbiguity = useMemo(
    () =>
      Array.isArray(diagnostic?.mbti?.ambiguityAxes)
        ? diagnostic?.mbti?.ambiguityAxes
        : [],
    [diagnostic?.mbti?.ambiguityAxes]
  );

  const businessAmbiguity = useMemo(
    () =>
      Array.isArray(diagnostic?.businessPersonality?.ambiguityAxes)
        ? diagnostic?.businessPersonality?.ambiguityAxes
        : [],
    [diagnostic?.businessPersonality?.ambiguityAxes]
  );

  const commentary = useMemo(
    () => buildDiagnosisCommentary(diagnostic || {}),
    [diagnostic]
  );

  const compatibilityGuide = useMemo(
    () => buildCompatibilityGuide(diagnostic || {}),
    [diagnostic]
  );

  const integratedInsights = useMemo(
    () =>
      generateInsights({
        mbti: mbtiType,
        business: businessType,
        mbtiTypeName,
        businessTypeName,
        mbtiAxes: diagnostic?.mbti?.axisResults,
        businessAxes: diagnostic?.businessPersonality?.axisResults,
        mbtiAmbiguity,
        businessAmbiguity,
        mbtiConfidence,
        businessConfidence,
      }),
    [
      mbtiType,
      businessType,
      mbtiTypeName,
      businessTypeName,
      diagnostic?.mbti?.axisResults,
      diagnostic?.businessPersonality?.axisResults,
      mbtiAmbiguity,
      businessAmbiguity,
      mbtiConfidence,
      businessConfidence,
    ]
  );

  const mbtiCommentaryBlock = useMemo(
    () => commentary.blocks.find((block) => block.title === "MBTI COMMENTARY"),
    [commentary.blocks]
  );

  const businessCommentaryBlock = useMemo(
    () => commentary.blocks.find((block) => block.title === "BUSINESS COMMENTARY"),
    [commentary.blocks]
  );

  const overallInsightBlock = useMemo(
    () => commentary.blocks.find((block) => block.title === "OVERALL INSIGHT"),
    [commentary.blocks]
  );

  const mbtiCommentaryText = useMemo(() => {
    if (mbtiType === "-" || !mbtiTypeName) {
      return (
        mbtiCommentaryBlock?.body || "MBTIのプロファイル情報はまだありません。"
      );
    }

    return mbtiCommentaryBlock?.body
      ? mbtiCommentaryBlock.body
      : `${mbtiType} の ${mbtiTypeName} は、${buildMbtiCore({
          mbtiCode: mbtiType,
          mbtiAxes: diagnostic?.mbti?.axisResults,
        })}${buildMbtiEmotion({
          mbtiCode: mbtiType,
          mbtiAxes: diagnostic?.mbti?.axisResults,
        })} そのため、考え方や反応には一貫した軸がある一方、役割や環境によって見え方が変わる余地もあります。`;
  }, [
    mbtiType,
    mbtiTypeName,
    mbtiCommentaryBlock?.body,
    diagnostic?.mbti?.axisResults,
  ]);

  const businessCommentaryText = useMemo(() => {
    if (businessType === "-" || !businessTypeName) {
      return (
        businessCommentaryBlock?.body ||
        commentary.businessProfile?.summary ||
        "タイプの詳細情報はまだ設定されていません。"
      );
    }

    return businessCommentaryBlock?.body
      ? businessCommentaryBlock.body
      : `${businessType} の ${businessTypeName} は、${buildBusinessWorkStyle({
          businessCode: businessType,
          businessAxes: diagnostic?.businessPersonality?.axisResults,
        })}${buildBusinessValueDriver({
          businessCode: businessType,
          businessAxes: diagnostic?.businessPersonality?.axisResults,
        })} 組織の中では、個人の成果と周囲との噛み合わせの両方が問われる役割で特に持ち味が出やすいです。`;
  }, [
    businessType,
    businessTypeName,
    businessCommentaryBlock?.body,
    commentary.businessProfile?.summary,
    diagnostic?.businessPersonality?.axisResults,
  ]);

  const mbtiCoreText = useMemo(
    () =>
      buildMbtiCore({
        mbtiCode: mbtiType,
        mbtiAxes: diagnostic?.mbti?.axisResults,
      }),
    [mbtiType, diagnostic?.mbti?.axisResults]
  );

  const mbtiEmotionText = useMemo(
    () =>
      buildMbtiEmotion({
        mbtiCode: mbtiType,
        mbtiAxes: diagnostic?.mbti?.axisResults,
      }),
    [mbtiType, diagnostic?.mbti?.axisResults]
  );

  const mbtiBlindSpotText = useMemo(
    () =>
      buildMbtiBlindSpot({
        mbtiCode: mbtiType,
        mbtiAmbiguity,
        mbtiAxes: diagnostic?.mbti?.axisResults,
        mbtiConfidence,
      }),
    [mbtiType, mbtiAmbiguity, diagnostic?.mbti?.axisResults, mbtiConfidence]
  );

  const businessWorkStyleText = useMemo(
    () =>
      buildBusinessWorkStyle({
        businessCode: businessType,
        businessAxes: diagnostic?.businessPersonality?.axisResults,
      }),
    [businessType, diagnostic?.businessPersonality?.axisResults]
  );

  const businessValueDriverText = useMemo(
    () =>
      buildBusinessValueDriver({
        businessCode: businessType,
        businessAxes: diagnostic?.businessPersonality?.axisResults,
      }),
    [businessType, diagnostic?.businessPersonality?.axisResults]
  );

  const businessBlindSpotText = useMemo(
    () =>
      buildBusinessBlindSpot({
        businessCode: businessType,
        businessAxes: diagnostic?.businessPersonality?.axisResults,
        businessAmbiguity,
      }),
    [
      businessType,
      diagnostic?.businessPersonality?.axisResults,
      businessAmbiguity,
    ]
  );

  const aiInsightBlocks = useMemo(
    () => [
      {
        title: `統合人物像 / ${integratedInsights.archetypeLabel}`,
        body: overallInsightBlock?.body || integratedInsights.summary,
      },
      {
        title: "強み・衝突リスク・配置適性",
        body: `${integratedInsights.strengths}${integratedInsights.weaknesses}`,
      },
      {
        title: "成長戦略・コミュニケーション指針",
        body: `${integratedInsights.actions}${integratedInsights.communication}${integratedInsights.managerGuide}${integratedInsights.memberGuide}`,
      },
    ],
    [integratedInsights, overallInsightBlock?.body]
  );

  const compatibilityCards = useMemo(
    () => [
      {
        title: compatibilityGuide.fitTitle,
        body: compatibilityGuide.fitBody,
      },
      {
        title: compatibilityGuide.cautionTitle,
        body: compatibilityGuide.cautionBody,
      },
      {
        title: compatibilityGuide.adviceTitle,
        body: compatibilityGuide.adviceBody,
      },
    ],
    [compatibilityGuide]
  );

  if (loading) {
    return (
      <P4LoadingScreen
        title="RESULT LOADING"
        subtitle="診断結果を読み込み中..."
      />
    );
  }

  if (error) {
    return (
      <>
        <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5 md:gap-5">
            <PanelFrame>
              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedRole} />
              </div>
            </PanelFrame>

            <div className="rounded-[18px] border-[4px] border-black bg-[#ffd0d0] px-4 py-3.5 font-black text-[#7b1111] shadow-[0_6px_0_#000] md:rounded-[24px] md:px-4 md:py-4 md:shadow-[0_8px_0_#000]">
              {error}
            </div>
          </div>
        </main>

        <P4BottomNav role={normalizedRole} />
      </>
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  診断結果
                </div>
                <h1 className="mt-2.5 text-[24px] font-black leading-tight md:mt-4 md:text-4xl">
                  {profile?.name || "ユーザー"} の診断結果
                </h1>
                {profile?.nameKana && (
                  <p className="mt-1 text-[13px] font-black tracking-[0.04em] text-[#ffe46a] md:mt-2 md:text-base md:tracking-[0.08em]">
                    {profile.nameKana}
                  </p>
                )}
                <p className="mt-2 text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  MBTI とビジネス人格診断の結果を表示しています。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedRole} />
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="結果サマリー">
            <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="氏名"
                value={
                  <>
                    <p className="text-lg font-black leading-tight md:text-2xl">
                      {profile?.name || "-"}
                    </p>
                    {profile?.nameKana && (
                      <p className="mt-1 text-[12px] font-black tracking-[0.04em] text-[#ffe46a] md:mt-2 md:text-sm md:tracking-[0.08em]">
                        {profile.nameKana}
                      </p>
                    )}
                  </>
                }
              />
              <StatCard
                label="MBTI"
                value={
                  <>
                    <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                      {mbtiType}
                    </p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                      {mbtiTypeName}
                    </p>
                    <p className="mt-1.5 text-[12px] font-bold leading-5 text-white/70 md:mt-2 md:text-sm md:leading-6">
                      信頼度:{" "}
                      {typeof mbtiConfidence === "number" ? `${mbtiConfidence}%` : "-"}
                    </p>
                    <p className="mt-1 text-[10px] font-black text-white/55 md:text-xs">
                      ランク: {mbtiConfidenceRank}
                    </p>
                  </>
                }
              />
              <StatCard
                label="ビジネス人格"
                value={
                  <>
                    <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                      {businessType}
                    </p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                      {businessTypeName}
                    </p>
                    <p className="mt-1 text-[10px] font-black text-white/55 md:text-xs">
                      {integratedInsights.archetypeLabel}
                    </p>
                    <p className="mt-1.5 text-[12px] font-bold leading-5 text-white/70 md:mt-2 md:text-sm md:leading-6">
                      信頼度:{" "}
                      {typeof businessConfidence === "number"
                        ? `${businessConfidence}%`
                        : "-"}
                    </p>
                    <p className="mt-1 text-[10px] font-black text-white/55 md:text-xs">
                      ランク: {businessConfidenceRank}
                    </p>
                  </>
                }
              />
              <StatCard
                label="診断日時"
                value={
                  <p className="text-[15px] font-black leading-5 md:text-lg md:leading-6">
                    {formatDisplayDate(diagnostic?.diagnosedAt)}
                  </p>
                }
              />
            </div>
          </PanelFrame>

          <PanelFrame title="タイププロフィール">
            <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
              <div className="grid gap-3 md:gap-4">
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border-[3px] border-black bg-white px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                      MBTI
                    </span>
                    <span className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                      {mbtiType}
                    </span>
                  </div>

                  <p className="mt-2.5 text-[22px] font-black leading-tight text-[#ffe46a] md:mt-4 md:text-3xl">
                    {mbtiTypeName}
                  </p>

                  <p className="mt-2.5 text-[13px] font-bold leading-6 text-white/85 md:mt-4 md:text-sm md:leading-7">
                    {mbtiCommentaryText}
                  </p>
                </div>

                <div className="grid gap-3 md:gap-4 md:grid-cols-3">
                  <InsightCard title="性格の核" body={mbtiCoreText} />
                  <InsightCard title="感情パターン" body={mbtiEmotionText} />
                  <InsightCard title="見落としやすい点" body={mbtiBlindSpotText} />
                </div>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border-[3px] border-black bg-white px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                      ビジネス人格
                    </span>
                    <span className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                      {businessType}
                    </span>
                  </div>

                  <p className="mt-2.5 text-[22px] font-black leading-tight text-[#ffe46a] md:mt-4 md:text-3xl">
                    {commentary.businessProfile?.name || businessTypeName}
                  </p>

                  <p className="mt-2.5 text-[13px] font-bold leading-6 text-white/85 md:mt-4 md:text-sm md:leading-7">
                    {businessCommentaryText}
                  </p>
                </div>

                <div className="grid gap-3 md:gap-4 md:grid-cols-3">
                  <InsightCard title="仕事スタイル" body={businessWorkStyleText} />
                  <InsightCard title="価値の源泉" body={businessValueDriverText} />
                  <InsightCard title="見落としやすい点" body={businessBlindSpotText} />
                </div>
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="診断品質">
            <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
              <DiagnosticQualityCard
                title="MBTI 診断品質"
                score={mbtiConfidence}
                rank={mbtiConfidenceRank}
                summary={mbtiConfidenceSummary}
                detail={mbtiConfidenceDetail}
              />

              <DiagnosticQualityCard
                title="ビジネス人格 診断品質"
                score={businessConfidence}
                rank={businessConfidenceRank}
                summary={businessConfidenceSummary}
                detail={businessConfidenceDetail}
              />
            </div>
          </PanelFrame>

          <section className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
            <PanelFrame title="MBTI 詳細">
              <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  MBTIタイプ
                </p>
                <p className="mt-2 text-[28px] font-black leading-none text-[#ffe46a] md:mt-3 md:text-4xl">
                  {mbtiType}
                </p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                  {mbtiTypeName}
                </p>
              </div>

              <div className="mt-3 rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:mt-4 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  境界軸
                </p>
                {mbtiAmbiguity.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
                    {mbtiAmbiguity.map((axis) => (
                      <span
                        key={axis}
                        className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]"
                      >
                        {formatAxisLabel(axis)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    境界軸はありません。
                  </p>
                )}
              </div>

              <div className="mt-3 rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:mt-4 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  MBTI 信頼度
                </p>
                <p className="mt-2 text-[28px] font-black leading-none text-[#ffe46a] md:mt-3 md:text-4xl">
                  {typeof mbtiConfidence === "number" ? `${mbtiConfidence}%` : "-"}
                </p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                  {mbtiConfidenceRank}
                </p>
                <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                  {mbtiConfidenceSummary || "診断品質コメントはまだありません。"}
                </p>
              </div>
            </PanelFrame>

            <PanelFrame title="ビジネス人格 詳細">
              <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  ビジネス人格タイプ
                </p>
                <p className="mt-2 text-[28px] font-black leading-none text-[#ffe46a] md:mt-3 md:text-4xl">
                  {businessType}
                </p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                  {businessTypeName}
                </p>
              </div>

              <div className="mt-3 rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:mt-4 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  境界軸
                </p>
                {businessAmbiguity.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 md:mt-3 md:gap-2">
                    {businessAmbiguity.map((axis) => (
                      <span
                        key={axis}
                        className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]"
                      >
                        {formatAxisLabel(axis)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    境界軸はありません。
                  </p>
                )}
              </div>

              <div className="mt-3 rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:mt-4 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                  ビジネス人格 信頼度
                </p>
                <p className="mt-2 text-[28px] font-black leading-none text-[#ffe46a] md:mt-3 md:text-4xl">
                  {typeof businessConfidence === "number"
                    ? `${businessConfidence}%`
                    : "-"}
                </p>
                <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                  {businessConfidenceRank}
                </p>
                <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                  {businessConfidenceSummary || "診断品質コメントはまだありません。"}
                </p>
              </div>
            </PanelFrame>
          </section>

          <PanelFrame title="AI解説">
            <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
              {aiInsightBlocks.map((block) => (
                <InsightCard key={block.title} title={block.title} body={block.body} />
              ))}
            </div>
          </PanelFrame>

          <section className="grid gap-3.5 lg:grid-cols-[1fr_1fr] lg:gap-5">
            <AxisPanel title="MBTI 軸バランス" axes={diagnostic?.mbti?.axisResults} />
            <AxisPanel
              title="ビジネス人格 軸バランス"
              axes={diagnostic?.businessPersonality?.axisResults}
            />
          </section>

          <PanelFrame title="相性ガイド">
            <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
              {compatibilityCards.map((card) => (
                <InsightCard key={card.title} title={card.title} body={card.body} />
              ))}
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}
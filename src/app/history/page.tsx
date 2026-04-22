"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { getReDiagnosisStatus } from "@/lib/diagnosis/rules";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";
import {
  getBusinessShortDescription,
  getMbtiShortDescription,
} from "@/lib/diagnosis/typeDescriptions";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

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
};

type CurrentDiagnosticData = {
  userId?: string;
  mbti?: {
    type?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  diagnosedAt?: string;
};

type DiagnosticHistoryItem = {
  userId?: string;
  mbti?: {
    type?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, AxisScore>;
  };
  diagnosedAt?: string;
  historyCreatedAt?: string;
  createdAtServer?: Timestamp | null;
};

function normalizeRole(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getHistoryTimeValue(item: DiagnosticHistoryItem): number {
  if (
    item.createdAtServer &&
    typeof item.createdAtServer.toMillis === "function"
  ) {
    return item.createdAtServer.toMillis();
  }

  const raw = item.historyCreatedAt || item.diagnosedAt || "";
  if (!raw) return 0;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDateTime(value?: string, serverValue?: Timestamp | null): string {
  if (serverValue && typeof serverValue.toDate === "function") {
    return serverValue.toDate().toLocaleString("ja-JP");
  }

  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP");
}

function formatDiffLabel(current?: string, latest?: string): string {
  if (!latest || !current) return "-";
  if (current === latest) return "同じ";
  return "変化あり";
}

function formatConfidenceDiff(current?: number, latest?: number): string {
  const a = typeof current === "number" ? current : null;
  const b = typeof latest === "number" ? latest : null;

  if (a === null || b === null) return "-";

  const diff = a - b;
  if (diff === 0) return "±0";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function formatAxisPercent(value?: number): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
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

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diagnostic, setDiagnostic] = useState<CurrentDiagnosticData | null>(null);
  const [histories, setHistories] = useState<DiagnosticHistoryItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const diagnosticSnap = await getDoc(doc(db, "diagnostics_current", user.uid));

        if (userSnap.exists()) {
          const userData = userSnap.data() as Omit<UserProfile, "uid">;
          setProfile({
            ...userData,
            uid: user.uid,
          });
        }

        if (diagnosticSnap.exists()) {
          setDiagnostic(diagnosticSnap.data() as CurrentDiagnosticData);
        } else {
          setDiagnostic(null);
        }

        const q = query(
          collection(db, "diagnostics_history"),
          where("userId", "==", user.uid)
        );

        const snap = await getDocs(q);

        const list: DiagnosticHistoryItem[] = snap.docs
          .map((item) => item.data() as DiagnosticHistoryItem)
          .sort((a, b) => getHistoryTimeValue(b) - getHistoryTimeValue(a));

        setHistories(list);
      } catch (error) {
        console.error("履歴取得失敗:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const normalizedRole = normalizeRole(profile?.role);

  const reDiagnosis = useMemo(
    () => getReDiagnosisStatus(diagnostic?.diagnosedAt),
    [diagnostic?.diagnosedAt]
  );

  const latestHistory = histories.length > 0 ? histories[0] : null;

  const latestMbti = latestHistory?.mbti?.type || diagnostic?.mbti?.type || "-";
  const latestBusiness =
    latestHistory?.businessPersonality?.primaryType ||
    diagnostic?.businessPersonality?.primaryType ||
    "-";
  const latestBusinessName = getBusinessTypeName(latestBusiness);
  const latestConfidence =
    latestHistory?.businessPersonality?.confidence ??
    diagnostic?.businessPersonality?.confidence;

  const latestMbtiAxes =
    latestHistory?.mbti?.axisResults || diagnostic?.mbti?.axisResults;
  const latestBusinessAxes =
    latestHistory?.businessPersonality?.axisResults ||
    diagnostic?.businessPersonality?.axisResults;

  if (loading) {
    return (
      <P4LoadingScreen
        title="HISTORY LOADING"
        subtitle="診断履歴を読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  HISTORY
                </div>
                <h1 className="mt-2.5 text-[24px] font-black leading-tight md:mt-4 md:text-4xl">
                  診断履歴
                </h1>
                <p className="mt-2 text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  自分の診断履歴と直近の変化を確認できます。
                </p>
                <p className="mt-2.5 text-[15px] font-black leading-tight text-white md:mt-3 md:text-base">
                  {profile?.name || "-"}
                </p>
                {profile?.nameKana && (
                  <p className="mt-1 text-[12px] font-black tracking-[0.04em] text-[#ffe46a] md:text-sm md:tracking-[0.08em]">
                    {profile.nameKana}
                  </p>
                )}
              </div>

              <div className="hidden md:flex md:items-start md:gap-3">
                <div className="min-w-0 flex-1">
                  <P4PageNav role={normalizedRole} />
                </div>

                <div className="shrink-0">
                  {reDiagnosis.canRetake ? (
                    <Link href="/register/wizard" className="p4g-button p4g-button-dark">
                      再診断する
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="p4g-button p4g-button-dark cursor-not-allowed opacity-50"
                      disabled
                      title={`再診断可能日: ${reDiagnosis.nextAvailableDate ?? "-"}`}
                    >
                      再診断する
                    </button>
                  )}
                </div>
              </div>
            </div>
          </PanelFrame>

          <div className="grid gap-3 md:hidden">
            {reDiagnosis.canRetake ? (
              <Link href="/register/wizard" className="p4g-button p4g-button-dark">
                再診断する
              </Link>
            ) : (
              <button
                type="button"
                className="p4g-button p4g-button-dark cursor-not-allowed opacity-50"
                disabled
                title={`再診断可能日: ${reDiagnosis.nextAvailableDate ?? "-"}`}
              >
                再診断する
              </button>
            )}
          </div>

          {!reDiagnosis.canRetake && (
            <PanelFrame title="再診断ステータス">
              <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[20px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-bold leading-6 text-white/85 md:text-sm">
                  再診断はまだできません。
                </p>
                <p className="mt-1.5 text-[12px] leading-5 text-white/70 md:mt-2 md:text-sm md:leading-6">
                  あと {reDiagnosis.remainingDays} 日で再診断できます。
                </p>
                <p className="mt-1 text-[12px] leading-5 text-white/70 md:text-sm md:leading-6">
                  次回可能日: {reDiagnosis.nextAvailableDate || "-"}
                </p>
              </div>
            </PanelFrame>
          )}

          {(latestHistory || diagnostic) && (
            <PanelFrame title="最新結果サマリー">
              <div className="grid gap-3 md:grid-cols-3 md:gap-4">
                <StatCard
                  label="最新MBTI"
                  value={
                    <>
                      <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-3xl">
                        {latestMbti}
                      </p>
                      <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                        {getMbtiTypeName(latestMbti)}
                      </p>
                    </>
                  }
                />

                <StatCard
                  label="最新ビジネス人格"
                  value={
                    <>
                      <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-3xl">
                        {latestBusiness}
                      </p>
                      <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                        {latestBusinessName}
                      </p>
                    </>
                  }
                />

                <StatCard
                  label="最新信頼度"
                  value={
                    <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-3xl">
                      {typeof latestConfidence === "number"
                        ? `${latestConfidence}%`
                        : "-"}
                    </p>
                  }
                />
              </div>

              <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2 md:mt-5 md:gap-4">
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    MBTI説明
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    {getMbtiShortDescription(latestMbti)}
                  </p>
                </div>

                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    ビジネス人格説明
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    {getBusinessShortDescription(latestBusiness)}
                  </p>
                </div>
              </div>

              <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2 md:mt-5 md:gap-4">
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    MBTI軸
                  </p>
                  <div className="mt-3 grid gap-2.5 md:gap-3">
                    {latestMbtiAxes ? (
                      Object.entries(latestMbtiAxes).map(([axis, score], index) => (
                        <div
                          key={`latest-mbti-${axis}-${index}`}
                          className="rounded-[12px] border-[3px] border-black bg-[#1b1b1b] p-3 md:rounded-[16px]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-black md:text-sm">{axis}</p>
                            <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                              {score.dominant || "-"}
                            </p>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-5 text-white/70 md:mt-2 md:text-xs md:leading-6">
                            {score.leftKey || "-"} {formatAxisPercent(score.leftRatio)} /{" "}
                            {score.rightKey || "-"} {formatAxisPercent(score.rightRatio)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] leading-6 text-white/80 md:text-sm">
                        まだMBTI軸データがありません。
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    Business軸
                  </p>
                  <div className="mt-3 grid gap-2.5 md:gap-3">
                    {latestBusinessAxes ? (
                      Object.entries(latestBusinessAxes).map(([axis, score], index) => (
                        <div
                          key={`latest-business-${axis}-${index}`}
                          className="rounded-[12px] border-[3px] border-black bg-[#1b1b1b] p-3 md:rounded-[16px]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] font-black md:text-sm">{axis}</p>
                            <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                              {score.dominant || "-"}
                            </p>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-5 text-white/70 md:mt-2 md:text-xs md:leading-6">
                            {score.leftKey || "-"} {formatAxisPercent(score.leftRatio)} /{" "}
                            {score.rightKey || "-"} {formatAxisPercent(score.rightRatio)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] leading-6 text-white/80 md:text-sm">
                        まだBusiness軸データがありません。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </PanelFrame>
          )}

          <PanelFrame title="履歴一覧">
            <div className="grid gap-3 md:gap-4">
              {histories.map((item, index) => {
                const isLatest = index === 0;

                const currentMbti = item.mbti?.type || "-";
                const currentBusiness = item.businessPersonality?.primaryType || "-";
                const currentBusinessName = getBusinessTypeName(currentBusiness);
                const currentConfidence = item.businessPersonality?.confidence;

                const mbtiDiffLabel = isLatest
                  ? "最新"
                  : formatDiffLabel(currentMbti, latestHistory?.mbti?.type);

                const businessDiffLabel = isLatest
                  ? "最新"
                  : formatDiffLabel(
                      currentBusiness,
                      latestHistory?.businessPersonality?.primaryType
                    );

                const confidenceDiff = isLatest
                  ? "最新"
                  : formatConfidenceDiff(
                      currentConfidence,
                      latestHistory?.businessPersonality?.confidence
                    );

                const safeKey = [
                  item.historyCreatedAt || "",
                  item.diagnosedAt || "",
                  String(index),
                ].join("__");

                return (
                  <div
                    key={safeKey}
                    className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                          診断日
                        </p>
                        <p className="mt-1.5 text-[15px] font-black leading-5 md:mt-2 md:text-lg md:leading-6">
                          {formatDateTime(
                            item.historyCreatedAt || item.diagnosedAt,
                            item.createdAtServer
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[12px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                          {isLatest ? "最新" : `#${index + 1}`}
                        </div>
                        <div className="rounded-full border-[3px] border-black bg-black px-3 py-1.5 text-[12px] font-black text-white shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                          信頼度:{" "}
                          {typeof currentConfidence === "number"
                            ? `${currentConfidence}%`
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2 md:mt-5 md:gap-4">
                      <div className="rounded-[14px] border-[4px] border-black bg-black p-3.5 md:rounded-[20px] md:p-4">
                        <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                          MBTI
                        </p>
                        <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
                          {currentMbti}
                        </p>
                        <p className="mt-1 text-[12px] text-white/70 md:text-sm">
                          {getMbtiTypeName(currentMbti)}
                        </p>
                        <p className="mt-2.5 text-[12px] font-bold leading-5 text-white/70 md:mt-3 md:text-sm md:leading-6">
                          最新との差分: {mbtiDiffLabel}
                        </p>
                        <p className="mt-2.5 text-[13px] leading-6 text-white/75 md:mt-3 md:text-sm md:leading-7">
                          {getMbtiShortDescription(currentMbti)}
                        </p>
                      </div>

                      <div className="rounded-[14px] border-[4px] border-black bg-black p-3.5 md:rounded-[20px] md:p-4">
                        <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                          ビジネス人格
                        </p>
                        <p className="mt-1.5 text-[24px] font-black leading-none text-[#ffe46a] md:mt-2 md:text-2xl">
                          {currentBusiness}
                        </p>
                        <p className="mt-1 text-[12px] text-white/70 md:text-sm">
                          {currentBusinessName}
                        </p>
                        <p className="mt-2.5 text-[12px] font-bold leading-5 text-white/70 md:mt-3 md:text-sm md:leading-6">
                          最新との差分: {businessDiffLabel}
                        </p>
                        <p className="mt-2.5 text-[13px] leading-6 text-white/75 md:mt-3 md:text-sm md:leading-7">
                          {getBusinessShortDescription(currentBusiness)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[14px] border-[3px] border-black bg-[#1a1a1a] p-3 md:mt-4 md:rounded-[18px] md:p-4">
                      <p className="text-[12px] font-bold leading-5 text-white/75 md:text-sm md:leading-6">
                        信頼度差分: {confidenceDiff}
                      </p>
                    </div>
                  </div>
                );
              })}

              {histories.length === 0 && (
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] leading-6 text-white/80 md:text-sm">
                    まだ診断履歴がありません。
                  </p>
                </div>
              )}
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}
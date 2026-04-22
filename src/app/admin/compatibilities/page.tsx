"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { calculateCompatibilityFromCurrentDocs } from "@/lib/diagnosis/compatibility";
import P4LoadingScreen from "@/components/P4LoadingScreen";
import P4BottomNav from "@/components/P4BottomNav";
import P4PageNav from "@/components/P4PageNav";

type CompatibilityInput = Parameters<
  typeof calculateCompatibilityFromCurrentDocs
>[0];

type UserProfile = {
  uid: string;
  name?: string;
  nameKana?: string;
  email?: string;
  role?: string;
  departmentName?: string;
  status?: string;
};

type RawAxisResult = {
  rawScore?: number;
  normalizedScore?: number;
  side?: string;
  confidence?: number;
  isBorderline?: boolean;
};

type RawDiagnosticsCurrentDoc = {
  userId?: string;
  mbti?: {
    type?: string;
    strengths?: string[];
    weaknesses?: string[];
    traits?: string[];
    axisResults?: Record<string, RawAxisResult>;
  };
  businessPersonality?: {
    primaryType?: string;
    secondaryType?: string | string[];
    ambiguityAxes?: string[];
    typeName?: string;
    cluster?: string;
    summary?: string;
    communicationTips?: string[];
    cautions?: string[];
    axisResults?: Record<string, RawAxisResult>;
  };
  diagnosedAt?: string;
  availableRetakeAt?: string;
  historyVersion?: number;
  updatedAt?: string;
};

type SimpleUser = {
  uid: string;
  name: string;
  mbti: string;
  businessCode: string;
  hasDiagnostic: boolean;
  status: string;
};

type NormalizedAxisResult = {
  rawScore: number;
  normalizedScore: number;
  side: string;
  confidence: number;
  isBorderline: boolean;
};

type MessageTone = "info" | "success" | "error";

const BATCH_LIMIT = 400;

function normalizeRoleForNav(value?: string) {
  return (value || "").trim().toLowerCase();
}

function PanelFrame({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border-[3px] border-black bg-[#171717] shadow-[0_6px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_10px_0_#000]">
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

function normalizeUserName(value?: string) {
  return value && value.trim() !== "" ? value : "未設定";
}

function normalizeStatus(value?: string) {
  return (value || "").trim().toLowerCase();
}

function isActiveStatus(value?: string) {
  return normalizeStatus(value) === "active";
}

function normalizeAxisResults(
  value?: Record<string, RawAxisResult>
): Record<string, NormalizedAxisResult> {
  const result: Record<string, NormalizedAxisResult> = {};

  for (const [key, axis] of Object.entries(value || {})) {
    result[key] = {
      rawScore: typeof axis?.rawScore === "number" ? axis.rawScore : 0,
      normalizedScore:
        typeof axis?.normalizedScore === "number" ? axis.normalizedScore : 0,
      side: typeof axis?.side === "string" ? axis.side : "",
      confidence: typeof axis?.confidence === "number" ? axis.confidence : 0,
      isBorderline: axis?.isBorderline === true,
    };
  }

  return result;
}

function normalizeSecondaryType(value?: string | string[]) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" / ");
  return "";
}

function toCompatibilityDiagnosticsDoc(
  uid: string,
  raw: RawDiagnosticsCurrentDoc | undefined
): CompatibilityInput | null {
  if (!raw) return null;

  const mbtiType = typeof raw.mbti?.type === "string" ? raw.mbti.type : "";
  const businessPrimaryType =
    typeof raw.businessPersonality?.primaryType === "string"
      ? raw.businessPersonality.primaryType
      : "";

  if (!mbtiType || !businessPrimaryType) {
    return null;
  }

  return {
    userId: uid,
    mbti: {
      type: mbtiType,
      strengths: Array.isArray(raw.mbti?.strengths) ? raw.mbti.strengths : [],
      weaknesses: Array.isArray(raw.mbti?.weaknesses)
        ? raw.mbti.weaknesses
        : [],
      traits: Array.isArray(raw.mbti?.traits) ? raw.mbti.traits : [],
      axisResults: normalizeAxisResults(raw.mbti?.axisResults),
    },
    businessPersonality: {
      primaryType: businessPrimaryType,
      secondaryType: normalizeSecondaryType(raw.businessPersonality?.secondaryType),
      ambiguityAxes: Array.isArray(raw.businessPersonality?.ambiguityAxes)
        ? raw.businessPersonality.ambiguityAxes
        : [],
      typeName:
        typeof raw.businessPersonality?.typeName === "string"
          ? raw.businessPersonality.typeName
          : businessPrimaryType,
      cluster:
        typeof raw.businessPersonality?.cluster === "string"
          ? raw.businessPersonality.cluster
          : "",
      summary:
        typeof raw.businessPersonality?.summary === "string"
          ? raw.businessPersonality.summary
          : "",
      communicationTips: Array.isArray(raw.businessPersonality?.communicationTips)
        ? raw.businessPersonality.communicationTips
        : [],
      cautions: Array.isArray(raw.businessPersonality?.cautions)
        ? raw.businessPersonality.cautions
        : [],
      axisResults: normalizeAxisResults(raw.businessPersonality?.axisResults),
    },
    diagnosedAt: typeof raw.diagnosedAt === "string" ? raw.diagnosedAt : "",
    availableRetakeAt:
      typeof raw.availableRetakeAt === "string" ? raw.availableRetakeAt : "",
    historyVersion:
      typeof raw.historyVersion === "number" ? raw.historyVersion : 0,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function isValidDiagnostic(doc: CompatibilityInput | null) {
  return !!doc;
}

function messageClass(tone: MessageTone) {
  if (tone === "success") {
    return "bg-[#fff27a] text-black";
  }
  if (tone === "error") {
    return "bg-[#ffd0d0] text-[#7b1111]";
  }
  return "bg-[#111111] text-white";
}

export default function AdminCompatibilitiesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const meSnap = await getDoc(doc(db, "users", user.uid));
        if (!meSnap.exists()) {
          router.push("/login");
          return;
        }

        const me = {
          ...(meSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        };

        if ((me.role || "").toLowerCase() !== "admin") {
          router.push("/home");
          return;
        }

        setCurrentUser(me);

        const [userSnap, diagSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "diagnostics_current")),
        ]);

        const diagMap = new Map<string, CompatibilityInput | null>();
        diagSnap.forEach((d) => {
          diagMap.set(
            d.id,
            toCompatibilityDiagnosticsDoc(
              d.id,
              d.data() as RawDiagnosticsCurrentDoc
            )
          );
        });

        const list: SimpleUser[] = userSnap.docs
          .map((u) => {
            const userData = u.data() as UserProfile;
            const d = diagMap.get(u.id) ?? null;

            return {
              uid: u.id,
              name: normalizeUserName(userData.name || ""),
              mbti: d?.mbti?.type || "-",
              businessCode: d?.businessPersonality?.primaryType || "-",
              hasDiagnostic: isValidDiagnostic(d),
              status: normalizeStatus(userData.status || "pending"),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));

        setUsers(list);
      } catch (e) {
        console.error("compatibilities 読み込み失敗:", e);
        setMessageTone("error");
        setMessage("相性データ生成画面の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const normalizedCurrentRole = normalizeRoleForNav(currentUser?.role);

  const diagnosticReadyUsers = useMemo(() => {
    return users.filter((user) => user.hasDiagnostic);
  }, [users]);

  const generationTargetUsers = useMemo(() => {
    return users.filter(
      (user) => user.hasDiagnostic && isActiveStatus(user.status)
    );
  }, [users]);

  const inactiveButDiagnosedUsers = useMemo(() => {
    return users.filter(
      (user) => user.hasDiagnostic && !isActiveStatus(user.status)
    );
  }, [users]);

  const totalPairs = useMemo(() => {
    const count = generationTargetUsers.length;
    return count * (count - 1);
  }, [generationTargetUsers]);

  const handleGenerate = async () => {
    const ok = window.confirm("相性データを再生成しますか？");
    if (!ok) return;

    try {
      setGenerating(true);
      setMessageTone("info");
      setMessage("診断データを読み込み中...");

      const [userSnap, diagSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "diagnostics_current")),
      ]);

      const activeUserMap = new Map<string, UserProfile>();
      userSnap.forEach((snapshot) => {
        const userData = snapshot.data() as UserProfile;
        if (isActiveStatus(userData.status || "pending")) {
          activeUserMap.set(snapshot.id, {
            ...userData,
            uid: snapshot.id,
          });
        }
      });

      const diagnosticsMap = new Map<string, CompatibilityInput>();
      diagSnap.forEach((d) => {
        const normalized = toCompatibilityDiagnosticsDoc(
          d.id,
          d.data() as RawDiagnosticsCurrentDoc
        );
        if (normalized && activeUserMap.has(d.id)) {
          diagnosticsMap.set(d.id, normalized);
        }
      });

      const targetUserIds = Array.from(diagnosticsMap.keys());

      if (targetUserIds.length < 2) {
        setMessageTone("error");
        setMessage("相性生成対象の active かつ診断済みユーザーが2名未満です。");
        setGenerating(false);
        return;
      }

      let batch = writeBatch(db);
      let opCount = 0;
      let commitCount = 0;
      let generatedCount = 0;
      let skippedCount = 0;

      const commitCurrentBatch = async () => {
        if (opCount === 0) return;
        await batch.commit();
        commitCount += 1;
        batch = writeBatch(db);
        opCount = 0;
      };

      for (const leftId of targetUserIds) {
        const left = diagnosticsMap.get(leftId);

        if (!left) {
          skippedCount += 1;
          continue;
        }

        for (const rightId of targetUserIds) {
          if (leftId === rightId) continue;

          const right = diagnosticsMap.get(rightId);

          if (!right) {
            skippedCount += 1;
            continue;
          }

          const result = calculateCompatibilityFromCurrentDocs(left, right);
          const ref = doc(db, "compatibilities", leftId, "items", rightId);

          batch.set(
            ref,
            {
              targetUserId: rightId,
              score: result.score,
              confidence: result.confidence,
              category: result.category,
              categoryLabel: result.categoryLabel,
              summary: result.summary,
              strengths: result.strengths || [],
              risks: result.risks || [],
              advice: result.advice || [],
              layerScores: result.layerScores || null,
              businessTypePair: result.businessTypePair || "",
              mbtiPair: result.mbtiPair || "",
              clusterPair: result.clusterPair || "",
              matchedTags: result.matchedTags || [],
              conflictFlags: result.conflictFlags || [],
              complementFlags: result.complementFlags || [],
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          opCount += 1;
          generatedCount += 1;

          if (opCount >= BATCH_LIMIT) {
            setMessageTone("info");
            setMessage(`生成中... ${generatedCount} / ${totalPairs}`);
            await commitCurrentBatch();
          }
        }
      }

      await commitCurrentBatch();

      setMessageTone("success");
      setMessage(
        `再生成完了: ${generatedCount} 件 / 対象ユーザー ${targetUserIds.length} 名 / commit ${commitCount} 回 / skip ${skippedCount} 件`
      );
    } catch (e) {
      console.error("compatibilities 生成失敗:", e);
      setMessageTone("error");
      setMessage("相性データの再生成に失敗しました。");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <P4LoadingScreen
        title="COMPATIBILITIES LOADING"
        subtitle="相性データ生成画面を読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  管理者 相性データ
                </div>
                <h1 className="mt-2.5 text-[24px] font-black leading-tight md:mt-4 md:text-4xl">
                  相性データ再生成
                </h1>
                <p className="mt-2 max-w-3xl text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  diagnostics_current をもとに compatibilities を本番ロジックで再生成します。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedCurrentRole} />
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="概要">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4">
              <StatCard
                label="全ユーザー数"
                value={
                  <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                    {users.length}
                  </p>
                }
              />
              <StatCard
                label="診断済みユーザー"
                value={
                  <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                    {diagnosticReadyUsers.length}
                  </p>
                }
              />
              <StatCard
                label="生成対象ユーザー"
                value={
                  <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                    {generationTargetUsers.length}
                  </p>
                }
              />
              <StatCard
                label="生成対象ペア数"
                value={
                  <p className="text-[28px] font-black leading-none text-[#ffe46a] md:text-4xl">
                    {totalPairs}
                  </p>
                }
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 md:mt-5 md:flex-row md:flex-wrap md:items-center">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || generationTargetUsers.length < 2}
                className="inline-flex w-full justify-center rounded-[14px] border-[3px] border-black bg-[#f3c400] px-4 py-2.5 text-[12px] font-black text-black shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ffe15a] hover:shadow-[0_8px_0_#000] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:rounded-[16px] md:px-5 md:py-3 md:text-sm md:shadow-[0_6px_0_#000]"
              >
                {generating ? "生成中..." : "相性データを再生成"}
              </button>

              {message && (
                <div
                  className={`rounded-[14px] border-[3px] border-black px-3.5 py-2.5 text-[12px] font-bold shadow-[0_5px_0_#000] md:rounded-[16px] md:px-4 md:py-3 md:text-sm md:shadow-[0_6px_0_#000] ${messageClass(
                    messageTone
                  )}`}
                >
                  {message}
                </div>
              )}
            </div>

            {inactiveButDiagnosedUsers.length > 0 && (
              <div className="mt-4 rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:mt-5 md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]">
                <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                  生成対象外ユーザー
                </p>
                <p className="mt-2 text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-6">
                  診断済みでも status が active ではないユーザーは除外されます。
                </p>
                <p className="mt-2 text-[12px] font-bold leading-5 text-white/65 md:text-sm md:leading-6">
                  {inactiveButDiagnosedUsers.length} 名
                </p>
              </div>
            )}
          </PanelFrame>

          <PanelFrame title="対象ユーザー">
            <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {users.map((user) => {
                const statusLabel =
                  user.hasDiagnostic && isActiveStatus(user.status)
                    ? "生成対象"
                    : user.hasDiagnostic
                      ? "対象外"
                      : "未診断";

                const badgeClass =
                  user.hasDiagnostic && isActiveStatus(user.status)
                    ? "bg-[#f3c400] text-black"
                    : user.hasDiagnostic
                      ? "bg-[#fff27a] text-black"
                      : "bg-[#ffd0d0] text-black";

                return (
                  <div
                    key={user.uid}
                    className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-black leading-tight md:text-lg">
                          {user.name}
                        </p>
                        <p className="mt-1 break-all text-[10px] font-bold leading-4 text-white/65 md:text-xs md:leading-5">
                          {user.uid}
                        </p>
                      </div>

                      <div
                        className={`rounded-full border-[3px] border-black px-2.5 py-1 text-[10px] font-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000] ${badgeClass}`}
                      >
                        {statusLabel}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-[12px] font-bold leading-5 text-white/85 md:mt-4 md:space-y-2 md:text-sm md:leading-6">
                      <p>MBTI: {user.mbti}</p>
                      <p>ビジネス人格: {user.businessCode}</p>
                      <p>ステータス: {user.status || "-"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelFrame>

          <PanelFrame title="管理メモ">
            <div className="grid gap-1.5 text-[12px] font-bold leading-5 text-white/80 md:gap-2 md:text-sm md:leading-7">
              <p>
                相性データは active かつ診断済みユーザー同士のみ再生成されます。
              </p>
              <p>
                既存データは各ペアごとに merge 更新され、最新の診断ロジック結果で上書きされます。
              </p>
              <p>管理者: {currentUser?.name || "-"}</p>
              {currentUser?.nameKana && (
                <p className="text-[#ffe46a]">フリガナ: {currentUser.nameKana}</p>
              )}
              <p>メール: {currentUser?.email || "-"}</p>
            </div>
          </PanelFrame>
        </div>
      </main>

      <P4BottomNav role={normalizedCurrentRole} />
    </>
  );
}
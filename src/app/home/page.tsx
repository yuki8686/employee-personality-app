"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { getReDiagnosisStatus } from "@/lib/diagnosis/rules";
import { getDiagnosticsForUi } from "@/lib/diagnostics/current";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";
import { calculateCompatibility } from "@/lib/compatibility/engine";
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

type DiagnosticData = {
  userId?: string;
  mbti?: string;
  mbtiTypeName?: string;
  businessCode?: string;
  businessTypeName?: string;
  confidence?: number;
  diagnosedAt?: string;
  availableRetakeAt?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  traits?: string[] | string;
  mbtiAxisResults?: Record<string, number>;
  businessAxisResults?: Record<string, number>;
};

type PersonWithDiagnostic = {
  uid: string;
  name: string;
  role: string;
  departmentName: string;
  diagnostic: DiagnosticData | null;
};

type CompatibilityDoc = {
  targetUserId: string;
  score: number;
  confidence?: number;
  category: "good" | "complementary" | "challenging";
  categoryLabel?: string;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  advice?: string[];
};

type PersonSummary = {
  uid: string;
  name: string;
  role: string;
  departmentName: string;
  mbti: string;
  businessCode: string;
  businessTypeName: string;
};

type CompatibilityCard = {
  uid: string;
  name: string;
  role: string;
  departmentName: string;
  mbti: string;
  businessCode: string;
  businessTypeName: string;
  score: number;
  category: "good" | "complementary" | "challenging";
  categoryLabel: string;
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
};

type EngineDiagnosticData = {
  userId?: string;
  mbti?: string;
  businessCode?: string;
  businessTypeName?: string;
  confidence?: number;
  strengths?: string[];
  weaknesses?: string[];
  traits?: string[];
  mbtiAxisResults?: Record<string, number>;
  businessAxisResults?: Record<string, number>;
};

function normalizeList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim() !== "");
  }

  if (typeof value === "string" && value.trim() !== "") {
    return [value];
  }

  return [];
}

function normalizeRole(value?: string) {
  return (value || "").trim().toLowerCase();
}

function isAdmin(role?: string) {
  return normalizeRole(role) === "admin";
}

function isManager(role?: string) {
  return normalizeRole(role) === "manager";
}

function isEmployee(role?: string) {
  return normalizeRole(role) === "employee";
}

function canShowCompatibilityOnHome(role?: string) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
}

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

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function loadDiagnosticsByUserIds(
  userIds: string[]
): Promise<Map<string, DiagnosticData>> {
  const diagnosticsMap = new Map<string, DiagnosticData>();

  if (userIds.length === 0) return diagnosticsMap;

  const chunks = chunkArray(userIds, 10);

  for (const ids of chunks) {
    const q = query(
      collection(db, "diagnostics_current"),
      where(documentId(), "in", ids)
    );
    const snap = await getDocs(q);

    snap.forEach((item) => {
      const data = item.data() as {
        userId?: string;
        mbti?: {
          type?: string;
          confidence?: number;
          strengths?: string[] | string;
          weaknesses?: string[] | string;
          traits?: string[] | string;
          axisResults?: Record<
            string,
            {
              leftRatio?: number;
              rightRatio?: number;
              signedScore?: number;
              difference?: number;
              dominant?: string;
              leftKey?: string;
              rightKey?: string;
            }
          >;
        };
        businessPersonality?: {
          primaryType?: string;
          typeName?: string;
          confidence?: number;
          axisResults?: Record<
            string,
            {
              leftRatio?: number;
              rightRatio?: number;
              signedScore?: number;
              difference?: number;
              dominant?: string;
              leftKey?: string;
              rightKey?: string;
            }
          >;
        };
        diagnosedAt?: string;
        availableRetakeAt?: string;
      };

      const mbtiAxisResults: Record<string, number> = {};
      const businessAxisResults: Record<string, number> = {};

      for (const [key, value] of Object.entries(data.mbti?.axisResults || {})) {
        if (typeof value?.signedScore === "number") {
          mbtiAxisResults[key] = value.signedScore;
        } else if (typeof value?.difference === "number") {
          const dominant = value.dominant || "";
          const leftKey = value.leftKey || key[0] || "";
          const rightKey = value.rightKey || key[1] || "";
          if (dominant === leftKey) mbtiAxisResults[key] = -value.difference;
          else if (dominant === rightKey) mbtiAxisResults[key] = value.difference;
          else {
            const leftRatio =
              typeof value?.leftRatio === "number" ? value.leftRatio : 0.5;
            mbtiAxisResults[key] = Math.round((leftRatio - 0.5) * 100);
          }
        } else {
          const leftRatio =
            typeof value?.leftRatio === "number" ? value.leftRatio : 0.5;
          mbtiAxisResults[key] = Math.round((leftRatio - 0.5) * 100);
        }
      }

      for (const [key, value] of Object.entries(
        data.businessPersonality?.axisResults || {}
      )) {
        if (typeof value?.signedScore === "number") {
          businessAxisResults[key] = value.signedScore;
        } else if (typeof value?.difference === "number") {
          const dominant = value.dominant || "";
          const leftKey = value.leftKey || key[0] || "";
          const rightKey = value.rightKey || key[1] || "";
          if (dominant === leftKey) businessAxisResults[key] = -value.difference;
          else if (dominant === rightKey) businessAxisResults[key] = value.difference;
          else {
            const leftRatio =
              typeof value?.leftRatio === "number" ? value.leftRatio : 0.5;
            businessAxisResults[key] = Math.round((leftRatio - 0.5) * 100);
          }
        } else {
          const leftRatio =
            typeof value?.leftRatio === "number" ? value.leftRatio : 0.5;
          businessAxisResults[key] = Math.round((leftRatio - 0.5) * 100);
        }
      }

      const mbtiCode = data.mbti?.type || "-";
      const businessCode = data.businessPersonality?.primaryType || "-";

      diagnosticsMap.set(item.id, {
        userId: data.userId || item.id,
        mbti: mbtiCode,
        mbtiTypeName: getMbtiTypeName(mbtiCode),
        businessCode,
        businessTypeName: getBusinessTypeName(businessCode),
        confidence:
          typeof data.businessPersonality?.confidence === "number"
            ? data.businessPersonality.confidence
            : typeof data.mbti?.confidence === "number"
              ? data.mbti.confidence
              : 0,
        diagnosedAt: data.diagnosedAt || "",
        availableRetakeAt: data.availableRetakeAt || "",
        strengths: data.mbti?.strengths || [],
        weaknesses: data.mbti?.weaknesses || [],
        traits: data.mbti?.traits || [],
        mbtiAxisResults,
        businessAxisResults,
      });
    });
  }

  return diagnosticsMap;
}

function toPersonWithDiagnostic(
  item: QueryDocumentSnapshot,
  diagnosticsMap: Map<string, DiagnosticData>
): PersonWithDiagnostic {
  const data = item.data() as Omit<UserProfile, "uid">;

  return {
    uid: item.id,
    name: data.name || "名称未設定",
    role: data.role || "-",
    departmentName: data.departmentName || "-",
    diagnostic: diagnosticsMap.get(item.id) || null,
  };
}

async function loadPeopleByUserIds(
  userIds: string[]
): Promise<Map<string, PersonSummary>> {
  const peopleMap = new Map<string, PersonSummary>();
  if (userIds.length === 0) return peopleMap;

  const chunks = chunkArray(userIds, 10);

  for (const ids of chunks) {
    const [usersSnap, diagnosticsSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where(documentId(), "in", ids))),
      getDocs(
        query(collection(db, "diagnostics_current"), where(documentId(), "in", ids))
      ),
    ]);

    const diagnosticsMap = new Map<string, DiagnosticData>();
    diagnosticsSnap.forEach((snapshot) => {
      const data = snapshot.data() as {
        userId?: string;
        mbti?: {
          type?: string;
        };
        businessPersonality?: {
          primaryType?: string;
          typeName?: string;
        };
      };

      const mbtiCode = data.mbti?.type || "-";
      const businessCode = data.businessPersonality?.primaryType || "-";

      diagnosticsMap.set(snapshot.id, {
        userId: data.userId || snapshot.id,
        mbti: mbtiCode,
        mbtiTypeName: getMbtiTypeName(mbtiCode),
        businessCode,
        businessTypeName: getBusinessTypeName(businessCode),
      });
    });

    usersSnap.forEach((snapshot) => {
      const user = snapshot.data() as UserProfile;
      const diagnostic = diagnosticsMap.get(snapshot.id);

      peopleMap.set(snapshot.id, {
        uid: snapshot.id,
        name: user.name || "名称未設定",
        role: user.role || "-",
        departmentName: user.departmentName || "-",
        mbti: diagnostic?.mbti || "-",
        businessCode: diagnostic?.businessCode || "-",
        businessTypeName: diagnostic?.businessTypeName || "-",
      });
    });
  }

  return peopleMap;
}

async function loadCompatibilitiesByUserId(
  userId: string
): Promise<Map<string, CompatibilityDoc>> {
  const compatibilityMap = new Map<string, CompatibilityDoc>();
  if (!userId) return compatibilityMap;

  const snap = await getDocs(collection(db, "compatibilities", userId, "items"));
  snap.forEach((item) => {
    const data = item.data() as Partial<CompatibilityDoc>;
    compatibilityMap.set(item.id, {
      targetUserId: data.targetUserId || item.id,
      score: typeof data.score === "number" ? data.score : 0,
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      category:
        data.category === "good" ||
        data.category === "complementary" ||
        data.category === "challenging"
          ? data.category
          : "challenging",
      categoryLabel:
        typeof data.categoryLabel === "string" && data.categoryLabel.trim() !== ""
          ? data.categoryLabel
          : data.category === "good"
            ? "良好関係"
            : data.category === "complementary"
              ? "補完関係"
              : "自分を広げてくれる相手",
      summary:
        typeof data.summary === "string" && data.summary.trim() !== ""
          ? data.summary
          : "相性データがあります。",
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      risks: Array.isArray(data.risks) ? data.risks : [],
      advice: Array.isArray(data.advice) ? data.advice : [],
    });
  });

  return compatibilityMap;
}

function buildCompatibilityLabel(category?: string, label?: string) {
  if (label && label.trim() !== "") return label;
  if (category === "good") return "良好関係";
  if (category === "complementary") return "補完関係";
  return "自分を広げてくれる相手";
}

function mapEngineLabelToCategory(
  label: "excellent" | "good" | "neutral" | "warning"
): CompatibilityCard["category"] {
  if (label === "excellent" || label === "good") return "good";
  if (label === "neutral") return "complementary";
  return "challenging";
}

function buildEngineDiagnosticData(
  data: DiagnosticData | null
): EngineDiagnosticData | null {
  if (!data) return null;
  if (!data.mbti || !data.businessCode) return null;

  return {
    userId: data.userId,
    mbti: data.mbti,
    businessCode: data.businessCode,
    businessTypeName: data.businessTypeName,
    confidence: data.confidence,
    strengths: normalizeList(data.strengths),
    weaknesses: normalizeList(data.weaknesses),
    traits: normalizeList(data.traits),
    mbtiAxisResults: data.mbtiAxisResults,
    businessAxisResults: data.businessAxisResults,
  };
}

function buildEngineReasonBuckets(reasons: string[]) {
  const normalized = reasons.filter((item) => item.trim() !== "");
  return {
    strengths: normalized.slice(0, 2),
    risks:
      normalized.length >= 3
        ? [normalized[2]]
        : ["進め方のすり合わせを先に行うと安定しやすいです。"],
    advice: [
      "最初にゴールと役割分担を共有する",
      "判断基準と相談タイミングを先に合わせる",
    ],
  };
}

function buildCompatibilityCardFromEngine(params: {
  person: PersonSummary;
  selfDiagnostic: DiagnosticData | null;
  otherDiagnostic: DiagnosticData | null;
}): CompatibilityCard | null {
  const { person, selfDiagnostic, otherDiagnostic } = params;
  const selfData = buildEngineDiagnosticData(selfDiagnostic);
  const otherData = buildEngineDiagnosticData(otherDiagnostic);

  if (!selfData || !otherData) return null;

  const result = calculateCompatibility(selfData, otherData);
  const category = mapEngineLabelToCategory(result.label);
  const buckets = buildEngineReasonBuckets(result.reasons);

  return {
    uid: person.uid,
    name: person.name,
    role: person.role,
    departmentName: person.departmentName,
    mbti: person.mbti,
    businessCode: person.businessCode,
    businessTypeName: person.businessTypeName,
    score: result.score,
    category,
    categoryLabel: buildCompatibilityLabel(category),
    summary: result.summary,
    strengths: buckets.strengths,
    risks: buckets.risks,
    advice: buckets.advice,
  };
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
      className={`relative overflow-hidden rounded-[24px] border-[3px] border-black bg-[#171717] shadow-[0_8px_0_#000] md:rounded-[28px] md:border-[4px] md:shadow-[0_10px_0_#000] ${className}`}
    >
      <div className="absolute left-0 top-0 h-2.5 w-full bg-[#f3c400] md:h-3" />
      <div className="absolute right-3 top-3 h-3.5 w-3.5 rotate-45 border-2 border-black bg-[#ffe46a] md:right-4 md:top-4 md:h-4 md:w-4" />
      <div className="relative p-4 pt-6 md:p-5 md:pt-7">
        {title && (
          <div className="mb-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
            {title}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function AdminShortcutButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[16px] border-[3px] border-black bg-[#111111] px-3.5 py-2.5 text-[13px] font-black text-white shadow-[0_5px_0_#000] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1b1b1b] hover:shadow-[0_7px_0_#000] active:translate-y-0 active:shadow-[0_3px_0_#000] md:rounded-[18px] md:px-4 md:py-3 md:text-sm md:shadow-[0_6px_0_#000] md:hover:shadow-[0_8px_0_#000]"
    >
      <span className="absolute inset-y-0 left-0 w-2 bg-white/10 transition-all duration-200 group-hover:w-4" />
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [compatibilityCards, setCompatibilityCards] = useState<CompatibilityCard[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const myUserRef = doc(db, "users", user.uid);
        const myUserSnap = await getDoc(myUserRef);

        if (!myUserSnap.exists()) {
          router.push("/login");
          return;
        }

        const myUserData = myUserSnap.data() as Omit<UserProfile, "uid">;
        const nextProfile: UserProfile = {
          ...myUserData,
          uid: user.uid,
        };
        setProfile(nextProfile);

        const myDiagnosticData = await getDiagnosticsForUi(user.uid);

        const status = (nextProfile.status || "active").toLowerCase();
        if (status === "pending" || !myDiagnosticData) {
          router.push("/register/wizard");
          return;
        }

        const normalizedDiagnostic: DiagnosticData = {
          ...myDiagnosticData,
          mbti: myDiagnosticData.mbti || "-",
          mbtiTypeName:
            myDiagnosticData.mbtiTypeName ||
            getMbtiTypeName(myDiagnosticData.mbti || "-"),
          businessCode: myDiagnosticData.businessCode || "-",
          businessTypeName: getBusinessTypeName(myDiagnosticData.businessCode || "-"),
        };

        setDiagnostic(normalizedDiagnostic);

        const myRole = normalizeRole(nextProfile.role);
        const myDepartment = nextProfile.departmentName || "";

        let userDocs: QueryDocumentSnapshot[] = [];
        let diagnosticsMap = new Map<string, DiagnosticData>();

        if (myRole === "admin") {
          const usersSnap = await getDocs(collection(db, "users"));
          userDocs = usersSnap.docs.filter((item) => item.id !== user.uid);
          diagnosticsMap = await loadDiagnosticsByUserIds(userDocs.map((d) => d.id));
        } else if (myRole === "manager") {
          const usersQuery = query(
            collection(db, "users"),
            where("departmentName", "==", myDepartment)
          );
          const usersSnap = await getDocs(usersQuery);
          userDocs = usersSnap.docs.filter((item) => item.id !== user.uid);
          diagnosticsMap = await loadDiagnosticsByUserIds(userDocs.map((d) => d.id));
        }

        const nextUsers = userDocs
          .map((item) => toPersonWithDiagnostic(item, diagnosticsMap))
          .sort((a, b) => a.name.localeCompare(b.name, "ja"));

        if (canShowCompatibilityOnHome(myRole)) {
          const compatMap = await loadCompatibilitiesByUserId(user.uid);
          const allVisibleIds = nextUsers.map((person) => person.uid);

          const [peopleMap, visibleDiagnosticsMap] = await Promise.all([
            loadPeopleByUserIds(allVisibleIds),
            loadDiagnosticsByUserIds(allVisibleIds),
          ]);

          const cards: CompatibilityCard[] = allVisibleIds
            .map((uid) => {
              const person = peopleMap.get(uid);
              if (!person) return null;

              const compat = compatMap.get(uid);
              if (compat) {
                return {
                  uid,
                  name: person.name,
                  role: person.role,
                  departmentName: person.departmentName,
                  mbti: person.mbti,
                  businessCode: person.businessCode,
                  businessTypeName: person.businessTypeName,
                  score: compat.score,
                  category: compat.category,
                  categoryLabel:
                    compat.categoryLabel || buildCompatibilityLabel(compat.category),
                  summary: compat.summary || "相性データがあります。",
                  strengths: compat.strengths || [],
                  risks: compat.risks || [],
                  advice: compat.advice || [],
                };
              }

              return buildCompatibilityCardFromEngine({
                person,
                selfDiagnostic: normalizedDiagnostic,
                otherDiagnostic: visibleDiagnosticsMap.get(uid) || null,
              });
            })
            .filter((item): item is CompatibilityCard => item !== null)
            .sort((a, b) => b.score - a.score);

          setCompatibilityCards(cards);
        } else {
          setCompatibilityCards([]);
        }
      } catch (error) {
        console.error("home 読み込み失敗:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const normalizedRole = normalizeRole(profile?.role);
  const isAdminUser = isAdmin(normalizedRole);
  const isManagerUser = isManager(normalizedRole);
  const isEmployeeUser = isEmployee(normalizedRole);
  const showCompatibility = canShowCompatibilityOnHome(normalizedRole);

  const strengths = useMemo(
    () => normalizeList(diagnostic?.strengths),
    [diagnostic?.strengths]
  );

  const traits = useMemo(
    () => normalizeList(diagnostic?.traits),
    [diagnostic?.traits]
  );

  const axisCards = useMemo(() => {
    if (!diagnostic?.mbtiAxisResults) return [];

    const axisMap: Record<string, string> = {
      EI: "E / I",
      SN: "S / N",
      TF: "T / F",
      JP: "J / P",
    };

    return Object.entries(diagnostic.mbtiAxisResults).map(([key, value]) => ({
      key,
      label: axisMap[key] || key,
      value: Math.round(Math.abs(value)),
    }));
  }, [diagnostic]);

  const bestMatches = useMemo(
    () => compatibilityCards.slice(0, 3),
    [compatibilityCards]
  );

  const homeLeadText = useMemo(() => {
    if (isAdminUser) {
      return "診断結果、全体状況、管理導線を確認できます。";
    }
    if (isManagerUser) {
      return "自分の診断結果と、自部署メンバーとの相性確認ができます。";
    }
    if (isEmployeeUser) {
      return "診断結果の概要と組織マップを確認できます。";
    }
    return "診断結果の概要を確認できます。";
  }, [isAdminUser, isManagerUser, isEmployeeUser]);

  const reDiagnosis = useMemo(
    () => getReDiagnosisStatus(diagnostic?.diagnosedAt),
    [diagnostic?.diagnosedAt]
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("ログアウト失敗:", error);
    }
  };

  if (loading) {
    return (
      <P4LoadingScreen
        title="HOME LOADING"
        subtitle="ホーム画面を読み込み中..."
      />
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-4 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  HOME
                </div>
                <h1 className="mt-3 text-[26px] font-black leading-tight md:mt-4 md:text-4xl">
                  {profile?.name || "ユーザー"} さんのホーム
                </h1>
                {profile?.nameKana && (
                  <p className="mt-1.5 text-sm font-black tracking-[0.06em] text-[#ffe46a] md:mt-2 md:text-base md:tracking-[0.08em]">
                    {profile.nameKana}
                  </p>
                )}
                <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:text-sm md:leading-normal">
                  {homeLeadText}
                </p>
              </div>

              <div className="hidden md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">
                <div className="min-w-0 flex-1">
                  <P4PageNav role={normalizedRole} />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="shrink-0 p4g-button p4g-button-dark"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </PanelFrame>

          {isAdminUser && (
            <PanelFrame title="ADMIN MENU">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 md:gap-3">
                <AdminShortcutButton href="/admin/users">
                  ユーザー管理
                </AdminShortcutButton>
                <AdminShortcutButton href="/admin/invitations">
                  招待リンク管理
                </AdminShortcutButton>
                <AdminShortcutButton href="/admin/diagnosis-master">
                  診断マスタ管理
                </AdminShortcutButton>
                <AdminShortcutButton href="/admin/compatibilities">
                  相性データ再生成
                </AdminShortcutButton>
              </div>
            </PanelFrame>
          )}

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:gap-5">
            <PanelFrame title="診断サマリー">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-black leading-tight md:text-2xl">
                  診断サマリー
                </h2>
                {reDiagnosis.canRetake ? (
                  <Link
                    href="/register/wizard"
                    className="p4g-button p4g-button-dark shrink-0"
                  >
                    再確認
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="p4g-button p4g-button-dark shrink-0 cursor-not-allowed opacity-50"
                    disabled
                    title={`再診断可能日: ${reDiagnosis.nextAvailableDate ?? "-"}`}
                  >
                    再確認
                  </button>
                )}
              </div>

              {!reDiagnosis.canRetake && (
                <div className="mt-4 rounded-[16px] border-[3px] border-black bg-[#111111] p-3.5 shadow-[0_5px_0_#000] md:rounded-[18px] md:p-4 md:shadow-[0_6px_0_#000]">
                  <p className="text-[13px] font-bold leading-6 text-white/85 md:text-sm">
                    再診断はまだできません。
                  </p>
                  <p className="mt-1.5 text-[13px] leading-6 text-white/70 md:mt-2 md:text-sm">
                    あと {reDiagnosis.remainingDays} 日で再診断できます。
                  </p>
                  <p className="mt-0.5 text-[13px] leading-6 text-white/70 md:mt-1 md:text-sm">
                    次回可能日: {reDiagnosis.nextAvailableDate || "-"}
                  </p>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:mt-5 md:gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[10px] font-black tracking-[0.14em] text-white/60 md:text-xs md:tracking-[0.15em]">
                    MBTI
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {diagnostic?.mbti || "-"}
                  </p>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                    {getMbtiTypeName(diagnostic?.mbti)}
                  </p>
                </div>

                <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[10px] font-black tracking-[0.14em] text-white/60 md:text-xs md:tracking-[0.15em]">
                    BUSINESS TYPE
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none text-[#ffe46a] md:text-4xl">
                    {diagnostic?.businessCode || "-"}
                  </p>
                  <p className="mt-2 text-[13px] font-bold leading-6 text-white/80 md:text-sm">
                    {getBusinessTypeName(diagnostic?.businessCode)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:mt-5 md:gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    強み
                  </p>
                  <ul className="mt-2.5 list-disc pl-5 text-[13px] leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    {(strengths.length > 0 ? strengths : ["まだ登録されていません"]).map(
                      (item) => (
                        <li key={item}>{item}</li>
                      )
                    )}
                  </ul>
                </div>

                <div className="rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                    特性メモ
                  </p>
                  <ul className="mt-2.5 list-disc pl-5 text-[13px] leading-6 text-white/80 md:mt-3 md:text-sm md:leading-7">
                    {(traits.length > 0 ? traits : ["まだ登録されていません"]).map(
                      (item) => (
                        <li key={item}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:mt-5 md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                <p className="text-[10px] font-black tracking-[0.14em] text-white/60 md:text-xs md:tracking-[0.15em]">
                  診断日時
                </p>
                <p className="mt-2.5 text-base font-black leading-6 text-[#ffe46a] md:mt-3 md:text-lg">
                  {formatDisplayDate(diagnostic?.diagnosedAt)}
                </p>
              </div>
            </PanelFrame>

            <PanelFrame title="MBTI 軸">
              <h2 className="text-xl font-black leading-tight md:text-2xl">MBTI 軸</h2>

              <div className="mt-4 grid gap-3 md:mt-5 md:gap-4">
                {axisCards.length > 0 ? (
                  axisCards.map((axis) => (
                    <div
                      key={axis.key}
                      className="rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-black md:text-sm">
                          {axis.label}
                        </p>
                        <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                          {axis.value}
                        </p>
                      </div>

                      <div className="mt-2.5 h-3.5 overflow-hidden rounded-full border-[3px] border-black bg-[#242424] md:mt-3 md:h-4">
                        <div
                          className="h-full bg-[#f3c400]"
                          style={{ width: `${axis.value}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-5 md:shadow-[0_8px_0_#000]">
                    <p className="text-[13px] font-bold leading-6 text-white/75 md:text-sm">
                      軸データがありません。
                    </p>
                  </div>
                )}
              </div>
            </PanelFrame>
          </section>

          {showCompatibility && (
            <PanelFrame title="相性サマリー">
              <h2 className="text-xl font-black leading-tight md:text-2xl">
                相性サマリー
              </h2>

              <div className="mt-4 grid gap-3 md:mt-5 md:gap-4">
                {bestMatches.length > 0 ? (
                  bestMatches.map((item) => (
                    <Link
                      key={item.uid}
                      href={`/profile/${item.uid}`}
                      className="block rounded-[18px] border-[4px] border-black bg-[#111111] p-3.5 shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-1 hover:bg-[#161616] hover:shadow-[0_10px_0_#000] md:rounded-[20px] md:p-4 md:shadow-[0_8px_0_#000]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-black leading-tight md:text-lg">
                            {item.name}
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-white/65 md:text-xs">
                            {item.role} / {item.departmentName}
                          </p>
                        </div>
                        {isAdminUser && (
                          <div className="shrink-0 rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1.5 text-[13px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                            {item.score}
                          </div>
                        )}
                      </div>

                      <p className="mt-3 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                        {item.categoryLabel}
                      </p>

                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div className="rounded-[14px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2">
                          <p className="text-[9px] font-black tracking-[0.14em] text-white/55 md:text-[10px] md:tracking-[0.15em]">
                            MBTI
                          </p>
                          <p className="mt-1 text-[13px] font-black text-[#ffe46a] md:text-sm">
                            {item.mbti}
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-xs">
                            {getMbtiTypeName(item.mbti)}
                          </p>
                        </div>

                        <div className="rounded-[14px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2">
                          <p className="text-[9px] font-black tracking-[0.14em] text-white/55 md:text-[10px] md:tracking-[0.15em]">
                            BUSINESS TYPE
                          </p>
                          <p className="mt-1 text-[13px] font-black text-[#ffe46a] md:text-sm">
                            {item.businessCode}
                          </p>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-xs">
                            {getBusinessTypeName(item.businessCode)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-[13px] font-bold leading-6 text-white/85 md:text-sm md:leading-7">
                        {item.summary}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_6px_0_#000] md:rounded-[20px] md:p-5 md:shadow-[0_8px_0_#000]">
                    <p className="text-[13px] font-bold leading-6 text-white/75 md:text-sm">
                      表示できる相性データがありません。
                    </p>
                  </div>
                )}
              </div>
            </PanelFrame>
          )}

          <div className="md:hidden">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full p4g-button p4g-button-dark"
            >
              ログアウト
            </button>
          </div>
        </div>
      </main>

      <P4BottomNav role={normalizedRole} />
    </>
  );
}
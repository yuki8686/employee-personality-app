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
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { canViewUserProfile } from "@/lib/permissions";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";
import {
  buildCompatibilityGuide,
  buildDiagnosisCommentary,
} from "@/lib/diagnosis/commentary";
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
  departmentId?: string;
  departmentName?: string;
  partnerCompany?: string;
  profileImageUrl?: string;
  status?: string;
  lastDiagnosedAt?: string | null;
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

type DiagnosticsCurrentDoc = {
  userId?: string;
  mbti?: {
    type?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    strengths?: string[];
    weaknesses?: string[];
    traits?: string[];
    axisResults?: Record<string, AxisScore>;
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
    confidence?: number;
    axisResults?: Record<string, AxisScore>;
  };
  diagnosedAt?: string;
  availableRetakeAt?: string;
  historyVersion?: number;
  updatedAt?: string;
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

type FeedbackSection = {
  id: string;
  title: string;
  content: string;
  order: number;
  isDefault?: boolean;
};

type FeedbackItem = {
  id: string;
  fromUid: string;
  fromName: string;
  fromRole: string;
  toUid: string;
  toName: string;
  toRole: string;
  departmentName: string;
  category: string;
  message: string;
  sections?: FeedbackSection[];
  createdAt: string;
  updatedAt?: string;
};

type SectionSummary = {
  title: string;
  contents: string[];
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

function normalizeRole(value?: string) {
  return (value || "").trim().toLowerCase();
}

function normalizeList(value: string[] | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim() !== "")
    : [];
}

function isAdmin(role?: string) {
  return normalizeRole(role) === "admin";
}

function canShowCompatibilityOnOtherProfile(role?: string) {
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

function formatPercent(value?: number): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

function getStatusLabel(status?: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  if (normalized === "disabled") return "disabled";
  return "-";
}

function getCategoryBadgeClass(category: CompatibilityCard["category"]) {
  if (category === "good") return "bg-[#fff8d9] text-black";
  if (category === "complementary") return "bg-[#d9f7ff] text-black";
  return "bg-[#ffd0d0] text-black";
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

function axisScoreToNumber(score?: AxisScore, axis?: string): number {
  if (!score) return 0;
  if (typeof score.signedScore === "number") return score.signedScore;

  const diff = typeof score.difference === "number" ? score.difference : 0;
  const dominant = score.dominant || "";
  const leftKey = score.leftKey || axis?.[0] || "";
  const rightKey = score.rightKey || axis?.[1] || "";

  if (!dominant) return 0;
  if (dominant === leftKey) return -diff;
  if (dominant === rightKey) return diff;
  return 0;
}

function buildAxisNumberMap(
  axes?: Record<string, AxisScore>
): Record<string, number> | undefined {
  if (!axes || Object.keys(axes).length === 0) return undefined;

  const result: Record<string, number> = {};
  for (const [axis, score] of Object.entries(axes)) {
    result[axis] = axisScoreToNumber(score, axis);
  }
  return result;
}

function buildEngineDiagnosticData(
  userId: string,
  diagnostic: DiagnosticsCurrentDoc | null
): EngineDiagnosticData | null {
  if (!diagnostic) return null;

  const mbtiCode = diagnostic.mbti?.type || "";
  const businessCode = diagnostic.businessPersonality?.primaryType || "";

  if (!mbtiCode || !businessCode) return null;

  const mbtiStrengths = normalizeList(diagnostic.mbti?.strengths);
  const mbtiWeaknesses = normalizeList(diagnostic.mbti?.weaknesses);
  const mbtiTraits = normalizeList(diagnostic.mbti?.traits);

  return {
    userId,
    mbti: mbtiCode,
    businessCode,
    businessTypeName: getBusinessTypeName(businessCode),
    confidence:
      typeof diagnostic.businessPersonality?.confidence === "number"
        ? diagnostic.businessPersonality.confidence
        : diagnostic.mbti?.confidence,
    strengths: mbtiStrengths,
    weaknesses: mbtiWeaknesses,
    traits: mbtiTraits,
    mbtiAxisResults: buildAxisNumberMap(diagnostic.mbti?.axisResults),
    businessAxisResults: buildAxisNumberMap(
      diagnostic.businessPersonality?.axisResults
    ),
  };
}

function buildCompatibilityCardFromEngine(params: {
  uid: string;
  person: PersonSummary;
  selfDiagnostic: DiagnosticsCurrentDoc | null;
  otherDiagnostic: DiagnosticsCurrentDoc | null;
}): CompatibilityCard | null {
  const { uid, person, selfDiagnostic, otherDiagnostic } = params;

  const selfData = buildEngineDiagnosticData("self", selfDiagnostic);
  const otherData = buildEngineDiagnosticData(uid, otherDiagnostic);

  if (!selfData || !otherData) return null;

  const result = calculateCompatibility(selfData, otherData);
  const category = mapEngineLabelToCategory(result.label);
  const buckets = buildEngineReasonBuckets(result.reasons);

  return {
    uid,
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

function extractFeedbackSections(item: FeedbackItem): FeedbackSection[] {
  if (Array.isArray(item.sections) && item.sections.length > 0) {
    return [...item.sections].sort((a, b) => a.order - b.order);
  }

  const raw = item.message || "";
  const chunks = raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return chunks.map((chunk, index) => {
    const lines = chunk.split("\n");
    const title = (lines[0] || "メモ").trim();
    const content = lines.slice(1).join("\n").trim() || "(未入力)";
    return {
      id: `${item.id}-legacy-${index}`,
      title,
      content,
      order: index,
      isDefault: false,
    };
  });
}

function summarizeFeedbackSections(feedbacks: FeedbackItem[]): SectionSummary[] {
  const grouped = new Map<string, string[]>();

  for (const feedback of feedbacks) {
    const sections = extractFeedbackSections(feedback);

    for (const section of sections) {
      const title = section.title.trim() || "その他";
      const content = section.content.trim();
      if (!content || content === "(未入力)") continue;

      if (!grouped.has(title)) {
        grouped.set(title, []);
      }
      grouped.get(title)?.push(content);
    }
  }

  return Array.from(grouped.entries())
    .map(([title, contents]) => ({
      title,
      contents: contents.slice(0, 3),
    }))
    .slice(0, 4);
}

function normalizeFeedbackItem(
  raw: Record<string, unknown>,
  id: string
): FeedbackItem {
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];

  const sections: FeedbackSection[] = rawSections
    .map((section, index) => {
      const value = section as Record<string, unknown>;
      return {
        id:
          typeof value.id === "string" && value.id.trim() !== ""
            ? value.id
            : `section-${id}-${index}`,
        title: typeof value.title === "string" ? value.title : "",
        content: typeof value.content === "string" ? value.content : "",
        order: typeof value.order === "number" ? value.order : index,
        isDefault: value.isDefault === true,
      };
    })
    .sort((a, b) => a.order - b.order);

  return {
    id,
    fromUid: typeof raw.fromUid === "string" ? raw.fromUid : "",
    fromName: typeof raw.fromName === "string" ? raw.fromName : "名称未設定",
    fromRole: typeof raw.fromRole === "string" ? raw.fromRole : "-",
    toUid: typeof raw.toUid === "string" ? raw.toUid : "",
    toName: typeof raw.toName === "string" ? raw.toName : "名称未設定",
    toRole: typeof raw.toRole === "string" ? raw.toRole : "-",
    departmentName:
      typeof raw.departmentName === "string" ? raw.departmentName : "-",
    category:
      typeof raw.category === "string" ? raw.category : "structured_feedback",
    message: typeof raw.message === "string" ? raw.message : "",
    sections,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
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

    const diagnosticsMap = new Map<string, DiagnosticsCurrentDoc>();
    diagnosticsSnap.forEach((snapshot) => {
      diagnosticsMap.set(snapshot.id, snapshot.data() as DiagnosticsCurrentDoc);
    });

    usersSnap.forEach((snapshot) => {
      const user = snapshot.data() as UserProfile;
      const diagnostic = diagnosticsMap.get(snapshot.id);
      const mbtiCode = diagnostic?.mbti?.type || "-";
      const businessCode = diagnostic?.businessPersonality?.primaryType || "-";

      peopleMap.set(snapshot.id, {
        uid: snapshot.id,
        name: user.name || "名称未設定",
        role: user.role || "-",
        departmentName: user.departmentName || "-",
        mbti: mbtiCode,
        businessCode,
        businessTypeName: getBusinessTypeName(businessCode),
      });
    });
  }

  return peopleMap;
}

async function loadDiagnosticsByUserIds(
  userIds: string[]
): Promise<Map<string, DiagnosticsCurrentDoc>> {
  const diagnosticsMap = new Map<string, DiagnosticsCurrentDoc>();
  if (userIds.length === 0) return diagnosticsMap;

  const chunks = chunkArray(userIds, 10);

  for (const ids of chunks) {
    const diagnosticsSnap = await getDocs(
      query(collection(db, "diagnostics_current"), where(documentId(), "in", ids))
    );

    diagnosticsSnap.forEach((snapshot) => {
      diagnosticsMap.set(snapshot.id, snapshot.data() as DiagnosticsCurrentDoc);
    });
  }

  return diagnosticsMap;
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
          : buildCompatibilityLabel(data.category),
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

async function loadFeedbacksForTarget(targetUid: string): Promise<FeedbackItem[]> {
  if (!targetUid) return [];

  const snap = await getDocs(
    query(collection(db, "feedbacks"), where("toUid", "==", targetUid))
  );

  return snap.docs
    .map((item) =>
      normalizeFeedbackItem(item.data() as Record<string, unknown>, item.id)
    )
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function buildMbtiCore(params: {
  mbtiCode: string;
  mbtiAxes?: Record<string, AxisScore> | null;
}) {
  const { mbtiCode, mbtiAxes } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "性格の核となる傾向はまだ取得できていません。";
  }

  const ei = mbtiAxes?.EI?.dominant || mbtiCode[0];
  const sn = mbtiAxes?.SN?.dominant || mbtiCode[1];

  const socialText =
    ei === "E"
      ? "外から刺激を受けるほどエネルギーが動きやすく"
      : "一人で整える時間があるほどエネルギーが回復しやすく";

  const perceptionText =
    sn === "N"
      ? "物事を可能性や意味の広がりで捉えやすいタイプです。"
      : "物事を現実性や具体性で捉えやすいタイプです。";

  return `${socialText}、${perceptionText}`;
}

function buildMbtiEmotion(params: {
  mbtiCode: string;
  mbtiAxes?: Record<string, AxisScore> | null;
}) {
  const { mbtiCode, mbtiAxes } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "感情傾向の補足情報はまだありません。";
  }

  const tf = mbtiAxes?.TF?.dominant || mbtiCode[2];
  const jp = mbtiAxes?.JP?.dominant || mbtiCode[3];

  const judgmentText =
    tf === "F"
      ? "感情や人間関係の温度差に敏感で、空気の乱れを受け取りやすい傾向があります。"
      : "気持ちより筋道を優先しやすく、感情に流されにくいぶん冷たく見られることがあります。";

  const stressText =
    jp === "J"
      ? "不確定さや予定の乱れが続くと、内側の負荷が上がりやすいです。"
      : "決めつけられたり自由度が下がると、気持ちが詰まりやすいです。";

  return `${judgmentText}${stressText}`;
}

function buildMbtiBlindSpot(params: {
  mbtiCode: string;
  mbtiAmbiguity: string[];
  mbtiAxes?: Record<string, AxisScore> | null;
  mbtiConfidence?: number;
}) {
  const { mbtiCode, mbtiAmbiguity, mbtiAxes, mbtiConfidence } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "見落としやすい傾向はまだ判定できていません。";
  }

  const weakAxes = Object.entries(mbtiAxes || {})
    .map(([axis, score]) => ({
      axis,
      difference: typeof score.difference === "number" ? score.difference : 0,
    }))
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 2)
    .map((item) => item.axis);

  const ambiguityText =
    mbtiAmbiguity.length > 0
      ? `${mbtiAmbiguity.join(" / ")} は境界に近く、場面によって見え方が揺れやすいです。`
      : weakAxes.length > 0
        ? `${weakAxes.join(" / ")} は比較的差が小さく、状況で反応が変わりやすいです。`
        : "一部の軸は状況次第で表情が変わる可能性があります。";

  const confidenceText =
    typeof mbtiConfidence === "number" && mbtiConfidence < 70
      ? "今回の結果は参考値として受け取りつつ、自分の実感とも照らし合わせるのが向いています。"
      : "普段の自分と強いときの自分を分けて見ると、より解像度が上がります。";

  return `${ambiguityText}${confidenceText}`;
}

function buildBusinessWorkStyle(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore> | null;
}) {
  const { businessCode, businessAxes } = params;
  if (!businessCode || businessCode === "-") {
    return "仕事スタイルの補足情報はまだありません。";
  }

  const mp = businessAxes?.MP?.dominant || businessCode[0];
  const cs = businessAxes?.CS?.dominant || businessCode[3];

  const stanceText =
    mp === "M"
      ? "全体を見ながら方向を整える動き方が得意で"
      : "現場で動きながら形にしていく動き方が得意で";

  const paceText =
    cs === "C"
      ? "比較的前に出て流れをつくりやすいタイプです。"
      : "安定や再現性を見ながら堅実に進めやすいタイプです。";

  return `${stanceText}、${paceText}`;
}

function buildBusinessValueDriver(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore> | null;
}) {
  const { businessCode, businessAxes } = params;
  if (!businessCode || businessCode === "-") {
    return "価値観の補足情報はまだありません。";
  }

  const qr = businessAxes?.QR?.dominant || businessCode[1];
  const vt = businessAxes?.VT?.dominant || businessCode[2];

  const motiveText =
    qr === "Q"
      ? "自分の成長や達成実感が強い燃料になりやすく"
      : "人や組織に価値を返せている感覚が強い燃料になりやすく";

  const criteriaText =
    vt === "V"
      ? "納得感や意味づけがあるほど力を出しやすい傾向があります。"
      : "条件や現実性が整っているほど力を出しやすい傾向があります。";

  return `${motiveText}、${criteriaText}`;
}

function buildBusinessBlindSpot(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore> | null;
  businessAmbiguity: string[];
}) {
  const { businessCode, businessAxes, businessAmbiguity } = params;
  if (!businessCode || businessCode === "-") {
    return "見落としやすい傾向はまだ判定できていません。";
  }

  const mp = businessAxes?.MP?.dominant || businessCode[0];
  const cs = businessAxes?.CS?.dominant || businessCode[3];

  const baseText =
    mp === "M"
      ? "前に出て整えようとするぶん、抱え込みや圧の強さとして見られることがあります。"
      : "現場対応に強いぶん、全体設計や優先順位の共有が薄く見えることがあります。";

  const riskText =
    cs === "C"
      ? "勢いが強い時ほど周囲の準備度との差が出やすいです。"
      : "慎重さが強い時ほど、機会を逃したように見られることがあります。";

  const ambiguityText =
    businessAmbiguity.length > 0
      ? `${businessAmbiguity.join(" / ")} は状況によって揺れやすい軸です。`
      : "";

  return `${baseText}${riskText}${ambiguityText}`.trim();
}

function buildProfileHeadline(params: {
  mbtiCode: string;
  businessCode: string;
  mbtiAxes?: Record<string, AxisScore> | null;
  businessAxes?: Record<string, AxisScore> | null;
}) {
  const { mbtiCode, businessCode, mbtiAxes, businessAxes } = params;

  if (!mbtiCode || mbtiCode === "-" || !businessCode || businessCode === "-") {
    return "診断データが不足しています。";
  }

  const ei = mbtiAxes?.EI?.dominant || mbtiCode[0];
  const mp = businessAxes?.MP?.dominant || businessCode[0];

  const base =
    ei === "E"
      ? "外部刺激で推進力が高まるタイプ"
      : "内省で精度を高めるタイプ";

  const work =
    mp === "M"
      ? "全体設計を担う司令塔型"
      : "現場で成果を出す実行型";

  return `${base}で、${work}。任せ方で成果が変わる人物。`;
}

function buildActionGuide(params: {
  mbtiCode: string;
  businessCode: string;
  mbtiAxes?: Record<string, AxisScore> | null;
  businessAxes?: Record<string, AxisScore> | null;
}) {
  const { mbtiCode, businessCode, mbtiAxes, businessAxes } = params;

  if (!mbtiCode || mbtiCode === "-" || !businessCode || businessCode === "-") {
    return ["診断データが不足しています。"];
  }

  const ei = mbtiAxes?.EI?.dominant || mbtiCode[0];
  const jp = mbtiAxes?.JP?.dominant || mbtiCode[3];
  const mp = businessAxes?.MP?.dominant || businessCode[0];
  const cs = businessAxes?.CS?.dominant || businessCode[3];

  const guides: string[] = [];

  guides.push(
    ei === "E"
      ? "会話ベースで情報共有すると理解が進みやすい"
      : "一度考える時間を渡すと精度が上がりやすい"
  );

  guides.push(
    jp === "J"
      ? "ゴールと期限を明確にすると安定して動きやすい"
      : "自由度を残した依頼の方が力を発揮しやすい"
  );

  guides.push(
    mp === "M"
      ? "役割全体や背景も共有すると判断しやすい"
      : "まず動ける形まで落とすと成果につながりやすい"
  );

  guides.push(
    cs === "C"
      ? "裁量を持たせると推進力が出やすい"
      : "手順や前提を揃えると再現性が高まりやすい"
  );

  return guides.slice(0, 4);
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
      <div className="relative p-3 pt-4.5 md:p-5 md:pt-7">
        {title && (
          <div className="mb-2.5 inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.08em] text-black shadow-[0_3px_0_#000] md:mb-4 md:px-3 md:text-xs md:tracking-normal md:shadow-[0_4px_0_#000]">
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
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] transition-transform duration-200 hover:-translate-y-1 md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
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
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {title}
      </p>
      <p className="mt-2 text-[13px] font-bold leading-5 text-white/85 md:mt-3 md:text-sm md:leading-7">
        {body}
      </p>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
        {title}
      </p>
      <div className="mt-2 grid gap-2 md:mt-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item}
              className="rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 text-[12px] font-bold leading-5 text-white/85 shadow-[0_3px_0_#000] md:rounded-[14px] md:text-sm md:leading-6 md:shadow-[0_4px_0_#000]"
            >
              {item}
            </div>
          ))
        ) : (
          <p className="text-[12px] font-bold leading-5 text-white/75 md:text-sm md:leading-6">
            情報がありません。
          </p>
        )}
      </div>
    </div>
  );
}

function AxisPanel({
  title,
  axes,
}: {
  title: string;
  axes?: Record<string, AxisScore> | null;
}) {
  return (
    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
      <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">{title}</p>

      <div className="mt-3 grid gap-3 md:mt-4 md:gap-4">
        {axes && Object.keys(axes).length > 0 ? (
          Object.entries(axes).map(([axis, score]) => {
            const leftRatio =
              typeof score.leftRatio === "number" ? score.leftRatio : 0.5;
            const rightRatio =
              typeof score.rightRatio === "number" ? score.rightRatio : 0.5;

            const dominant = score.dominant || "-";
            const leftKey = score.leftKey || "-";
            const rightKey = score.rightKey || "-";

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

                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-white/70 md:text-xs">
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
          <p className="text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-6">
            軸データがありません。
          </p>
        )}
      </div>
    </div>
  );
}

function CompatibilityListPanel({
  title,
  headline,
  items,
  emptyMessage,
  showScore,
}: {
  title: string;
  headline: string;
  items: CompatibilityCard[];
  emptyMessage: string;
  showScore: boolean;
}) {
  return (
    <PanelFrame title={title}>
      <h2 className="text-[18px] font-black leading-tight text-[#ffe46a] md:text-2xl">
        {headline}
      </h2>
      <div className="mt-3 grid gap-3 md:mt-5 md:gap-4">
        {items.map((item) => (
          <Link
            key={item.uid}
            href={`/profile/${item.uid}`}
            className="block rounded-[16px] border-[4px] border-black bg-[#111111] p-3 transition-all duration-200 hover:-translate-y-1 hover:bg-[#161616] hover:shadow-[0_12px_0_#000] md:rounded-[24px] md:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-black leading-tight md:text-xl">
                  {item.name}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-sm md:leading-normal">
                  {item.role} / {item.departmentName}
                </p>
              </div>
              {showScore && (
                <div className="shrink-0 rounded-full border-[3px] border-black bg-[#f3c400] px-3 py-1 text-[12px] font-black text-black shadow-[0_3px_0_#000] md:px-4 md:py-2 md:text-sm md:shadow-[0_4px_0_#000]">
                  {item.score}
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 md:rounded-[16px]">
                <p className="text-[9px] font-black tracking-[0.12em] text-white/55 md:text-[10px] md:tracking-[0.15em]">
                  MBTI
                </p>
                <p className="mt-1 text-[13px] font-black text-[#ffe46a] md:text-sm">
                  {item.mbti}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-xs">
                  {getMbtiTypeName(item.mbti)}
                </p>
              </div>
              <div className="rounded-[12px] border-[3px] border-black bg-[#1a1a1a] px-3 py-2 md:rounded-[16px]">
                <p className="text-[9px] font-black tracking-[0.12em] text-white/55 md:text-[10px] md:tracking-[0.15em]">
                  ビジネス人格
                </p>
                <p className="mt-1 text-[13px] font-black text-[#ffe46a] md:text-sm">
                  {item.businessCode}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-xs">
                  {getBusinessTypeName(item.businessCode)}
                </p>
              </div>
            </div>

            <p
              className={`mt-3 inline-flex rounded-full border-[3px] border-black px-2.5 py-1 text-[10px] font-black ${getCategoryBadgeClass(
                item.category
              )} md:px-3 md:text-xs`}
            >
              {item.categoryLabel}
            </p>

            <p className="mt-3 text-[13px] font-bold leading-5 text-white/85 md:mt-4 md:text-sm md:leading-7">
              {item.summary}
            </p>

            <ul className="mt-2 list-disc pl-5 text-[12px] leading-5 text-white/75 md:mt-3 md:text-sm md:leading-7">
              {(item.strengths.length > 0 ? item.strengths : item.advice).map(
                (text) => (
                  <li key={text}>{text}</li>
                )
              )}
            </ul>
          </Link>
        ))}

        {items.length === 0 && (
          <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
            <p className="text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-6">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </PanelFrame>
  );
}

export default function UserProfileDetailPage() {
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const targetUid = Array.isArray(params?.uid) ? params.uid[0] : params?.uid || "";

  const [loading, setLoading] = useState(true);
  const [viewerProfile, setViewerProfile] = useState<UserProfile | null>(null);
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [viewerDiagnostic, setViewerDiagnostic] = useState<DiagnosticsCurrentDoc | null>(
    null
  );
  const [targetDiagnostic, setTargetDiagnostic] = useState<DiagnosticsCurrentDoc | null>(
    null
  );
  const [compatibilityCards, setCompatibilityCards] = useState<CompatibilityCard[]>([]);
  const [directCompatibility, setDirectCompatibility] = useState<CompatibilityCard | null>(
    null
  );
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      if (!targetUid) {
        router.push("/profile");
        return;
      }

      try {
        const [viewerSnap, targetSnap, viewerDiagnosticSnap, diagnosticSnap] =
          await Promise.all([
            getDoc(doc(db, "users", user.uid)),
            getDoc(doc(db, "users", targetUid)),
            getDoc(doc(db, "diagnostics_current", user.uid)),
            getDoc(doc(db, "diagnostics_current", targetUid)),
          ]);

        if (!viewerSnap.exists()) {
          router.push("/login");
          return;
        }

        if (!targetSnap.exists()) {
          setError("対象ユーザーが見つかりません。");
          setLoading(false);
          return;
        }

        const viewer: UserProfile = {
          ...(viewerSnap.data() as Omit<UserProfile, "uid">),
          uid: user.uid,
        };
        const target: UserProfile = {
          ...(targetSnap.data() as Omit<UserProfile, "uid">),
          uid: targetUid,
        };

        setViewerProfile(viewer);
        setTargetProfile(target);
        setViewerDiagnostic(
          viewerDiagnosticSnap.exists()
            ? (viewerDiagnosticSnap.data() as DiagnosticsCurrentDoc)
            : null
        );

        if (user.uid === targetUid) {
          router.push("/profile");
          return;
        }

        const canView = await canViewUserProfile({
          currentUser: {
            uid: viewer.uid,
            name: viewer.name || "",
            email: viewer.email || "",
            departmentId: viewer.departmentId || "",
            departmentName: viewer.departmentName || "",
            role:
              (viewer.role as "admin" | "manager" | "employee" | "partner") ||
              "employee",
            status:
              (viewer.status as "pending" | "active" | "disabled") || "active",
          },
          targetUser: {
            uid: target.uid,
            name: target.name || "",
            email: target.email || "",
            departmentId: target.departmentId || "",
            departmentName: target.departmentName || "",
            role:
              (target.role as "admin" | "manager" | "employee" | "partner") ||
              "employee",
            status:
              (target.status as "pending" | "active" | "disabled") || "active",
          },
        });

        if (!canView && normalizeRole(viewer.role) !== "admin") {
          setError("このユーザーのプロフィールを閲覧する権限がありません。");
          setLoading(false);
          return;
        }

        const nextTargetDiagnostic = diagnosticSnap.exists()
          ? (diagnosticSnap.data() as DiagnosticsCurrentDoc)
          : null;
        setTargetDiagnostic(nextTargetDiagnostic);

        if (canShowCompatibilityOnOtherProfile(normalizeRole(viewer.role))) {
          const [viewerCompatMap, targetCompatMap] = await Promise.all([
            loadCompatibilitiesByUserId(viewer.uid),
            loadCompatibilitiesByUserId(targetUid),
          ]);

          const allNeededIds = Array.from(
            new Set<string>([
              targetUid,
              ...Array.from(targetCompatMap.keys()).filter((id) => id !== viewer.uid),
            ])
          );

          const peopleMap = await loadPeopleByUserIds(allNeededIds);
          const relatedDiagnosticsMap = await loadDiagnosticsByUserIds(allNeededIds);

          const directFromFirestore = viewerCompatMap.get(targetUid);
          const targetPerson = peopleMap.get(targetUid);

          if (directFromFirestore && targetPerson) {
            setDirectCompatibility({
              uid: targetUid,
              name: targetPerson.name,
              role: targetPerson.role,
              departmentName: targetPerson.departmentName,
              mbti: targetPerson.mbti,
              businessCode: targetPerson.businessCode,
              businessTypeName: targetPerson.businessTypeName,
              score: directFromFirestore.score,
              category: directFromFirestore.category,
              categoryLabel:
                directFromFirestore.categoryLabel ||
                buildCompatibilityLabel(directFromFirestore.category),
              summary: directFromFirestore.summary || "相性データがあります。",
              strengths: directFromFirestore.strengths || [],
              risks: directFromFirestore.risks || [],
              advice: directFromFirestore.advice || [],
            });
          } else if (targetPerson) {
            const engineCard = buildCompatibilityCardFromEngine({
              uid: targetUid,
              person: targetPerson,
              selfDiagnostic: viewerDiagnosticSnap.exists()
                ? (viewerDiagnosticSnap.data() as DiagnosticsCurrentDoc)
                : null,
              otherDiagnostic: nextTargetDiagnostic,
            });
            setDirectCompatibility(engineCard);
          } else {
            setDirectCompatibility(null);
          }

          const relatedIds = Array.from(targetCompatMap.keys()).filter(
            (id) => id !== viewer.uid
          );

          const cards: CompatibilityCard[] = relatedIds
            .map((uid) => {
              const compat = targetCompatMap.get(uid);
              const person = peopleMap.get(uid);
              if (!compat || !person) return null;

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
            })
            .filter((item): item is CompatibilityCard => item !== null)
            .sort((a, b) => b.score - a.score);

          if (cards.length > 0) {
            setCompatibilityCards(cards);
          } else {
            const fallbackCards: CompatibilityCard[] = Array.from(peopleMap.entries())
              .filter(([uid]) => uid !== targetUid)
              .map(([uid, person]) =>
                buildCompatibilityCardFromEngine({
                  uid,
                  person,
                  selfDiagnostic: nextTargetDiagnostic,
                  otherDiagnostic: relatedDiagnosticsMap.get(uid) || null,
                })
              )
              .filter((item): item is CompatibilityCard => item !== null)
              .sort((a, b) => b.score - a.score);

            setCompatibilityCards(fallbackCards);
          }
        } else {
          setDirectCompatibility(null);
          setCompatibilityCards([]);
        }

        const nextFeedbacks = await loadFeedbacksForTarget(targetUid);
        setFeedbacks(nextFeedbacks);
      } catch (e) {
        console.error("profile/[uid] 読み込み失敗:", e);
        setError("プロフィール情報の読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, targetUid]);

  const normalizedViewerRole = normalizeRole(viewerProfile?.role);
  const showCompatibility = canShowCompatibilityOnOtherProfile(normalizedViewerRole);
  const showScore = isAdmin(normalizedViewerRole);

  const bestMatches = useMemo(
    () => compatibilityCards.filter((item) => item.category === "good").slice(0, 3),
    [compatibilityCards]
  );

  const supportMatches = useMemo(
    () =>
      compatibilityCards
        .filter((item) => item.category === "complementary")
        .slice(0, 3),
    [compatibilityCards]
  );

  const stretchMatches = useMemo(
    () =>
      [...compatibilityCards]
        .filter((item) => item.category === "challenging")
        .sort((a, b) => a.score - b.score)
        .slice(0, 3),
    [compatibilityCards]
  );

  const feedbackSectionSummaries = useMemo(
    () => summarizeFeedbackSections(feedbacks),
    [feedbacks]
  );

  const latestFeedbackDate = useMemo(
    () => (feedbacks.length > 0 ? formatDisplayDate(feedbacks[0]?.createdAt) : "-"),
    [feedbacks]
  );

  const latestFeedbacks = useMemo(() => feedbacks.slice(0, 5), [feedbacks]);

  const mbtiAxes = targetDiagnostic?.mbti?.axisResults || null;
  const businessAxes = targetDiagnostic?.businessPersonality?.axisResults || null;
  const mbtiCode = targetDiagnostic?.mbti?.type || "-";
  const businessCode = targetDiagnostic?.businessPersonality?.primaryType || "-";

  const commentary = useMemo(
    () => buildDiagnosisCommentary(targetDiagnostic || {}),
    [targetDiagnostic]
  );

  const compatibilityGuide = useMemo(
    () => buildCompatibilityGuide(targetDiagnostic || {}),
    [targetDiagnostic]
  );

  const mbtiConfidence = targetDiagnostic?.mbti?.confidence;
  const businessConfidence = targetDiagnostic?.businessPersonality?.confidence;

  const mbtiAmbiguity = useMemo(
    () =>
      Array.isArray(targetDiagnostic?.mbti?.ambiguityAxes)
        ? targetDiagnostic.mbti.ambiguityAxes
        : [],
    [targetDiagnostic?.mbti?.ambiguityAxes]
  );

  const businessAmbiguity = useMemo(
    () =>
      Array.isArray(targetDiagnostic?.businessPersonality?.ambiguityAxes)
        ? targetDiagnostic.businessPersonality.ambiguityAxes
        : [],
    [targetDiagnostic?.businessPersonality?.ambiguityAxes]
  );

  const mbtiCommentaryBlock = useMemo(
    () => commentary.blocks.find((block) => block.title === "MBTI COMMENTARY"),
    [commentary.blocks]
  );

  const businessCommentaryBlock = useMemo(
    () => commentary.blocks.find((block) => block.title === "BUSINESS COMMENTARY"),
    [commentary.blocks]
  );

  const hasDiagnosis = Boolean(
    targetDiagnostic?.mbti?.type && targetDiagnostic?.businessPersonality?.primaryType
  );

  const mbtiCoreText = useMemo(
    () => buildMbtiCore({ mbtiCode, mbtiAxes }),
    [mbtiCode, mbtiAxes]
  );

  const mbtiEmotionText = useMemo(
    () => buildMbtiEmotion({ mbtiCode, mbtiAxes }),
    [mbtiCode, mbtiAxes]
  );

  const mbtiBlindSpotText = useMemo(
    () =>
      buildMbtiBlindSpot({
        mbtiCode,
        mbtiAmbiguity,
        mbtiAxes,
        mbtiConfidence,
      }),
    [mbtiCode, mbtiAmbiguity, mbtiAxes, mbtiConfidence]
  );

  const businessWorkStyleText = useMemo(
    () => buildBusinessWorkStyle({ businessCode, businessAxes }),
    [businessCode, businessAxes]
  );

  const businessValueDriverText = useMemo(
    () => buildBusinessValueDriver({ businessCode, businessAxes }),
    [businessCode, businessAxes]
  );

  const businessBlindSpotText = useMemo(
    () =>
      buildBusinessBlindSpot({
        businessCode,
        businessAxes,
        businessAmbiguity,
      }),
    [businessCode, businessAxes, businessAmbiguity]
  );

  const profileHeadlineText = useMemo(
    () =>
      buildProfileHeadline({
        mbtiCode,
        businessCode,
        mbtiAxes,
        businessAxes,
      }),
    [mbtiCode, businessCode, mbtiAxes, businessAxes]
  );

  const actionGuideItems = useMemo(
    () =>
      buildActionGuide({
        mbtiCode,
        businessCode,
        mbtiAxes,
        businessAxes,
      }),
    [mbtiCode, businessCode, mbtiAxes, businessAxes]
  );

  if (loading) {
    return (
      <P4LoadingScreen
        title="MEMBER PROFILE LOADING"
        subtitle="メンバー情報を読み込み中..."
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
                <P4PageNav role={normalizedViewerRole} />
              </div>
            </PanelFrame>

            <div className="rounded-[16px] border-[4px] border-black bg-[#ffd0d0] px-4 py-4 text-[13px] font-black text-[#7b1111] shadow-[0_5px_0_#000] md:rounded-[24px] md:text-base md:shadow-[0_8px_0_#000]">
              {error}
            </div>
          </div>
        </main>

        <P4BottomNav role={normalizedViewerRole} />
      </>
    );
  }

  return (
    <>
      <main className="p4g-shell min-h-screen px-3 py-3.5 pb-24 text-white md:px-4 md:py-6 md:pb-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 md:gap-5">
          <PanelFrame>
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:tracking-[0.18em] md:shadow-[0_4px_0_#000]">
                  他者プロフィール
                </div>
                <h1 className="mt-2.5 text-[18px] font-black leading-tight md:mt-4 md:text-4xl">
                  {targetProfile?.name || "ユーザー"} のプロフィール
                </h1>
                {targetProfile?.nameKana && (
                  <p className="mt-1 text-[12px] font-black tracking-[0.04em] text-[#ffe46a] md:mt-2 md:text-base md:tracking-[0.08em]">
                    {targetProfile.nameKana}
                  </p>
                )}
                <p className="mt-2 max-w-3xl text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-normal">
                  他ユーザーの診断傾向、受信フィードバック、相性情報を表示しています。
                </p>
              </div>

              <div className="hidden md:flex md:flex-col md:gap-3">
                <P4PageNav role={normalizedViewerRole} />
              </div>
            </div>
          </PanelFrame>

          <PanelFrame title="プロフィール概要">
            <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="氏名"
                value={
                  <>
                    <p className="text-[16px] font-black leading-tight md:text-2xl">
                      {targetProfile?.name || "-"}
                    </p>
                    {targetProfile?.nameKana && (
                      <p className="mt-1 text-[12px] font-black tracking-[0.04em] text-[#ffe46a] md:mt-2 md:text-sm md:tracking-[0.08em]">
                        {targetProfile.nameKana}
                      </p>
                    )}
                  </>
                }
              />
              <StatCard
                label="部署"
                value={
                  <p className="text-[16px] font-black leading-tight md:text-xl">
                    {targetProfile?.departmentName || "-"}
                  </p>
                }
              />
              <StatCard
                label="ロール / ステータス"
                value={
                  <>
                    <p className="text-[16px] font-black leading-tight md:text-xl">
                      {targetProfile?.role || "-"}
                    </p>
                    <p className="mt-1 text-[12px] font-bold leading-5 text-white/70 md:mt-2 md:text-sm md:leading-6">
                      {getStatusLabel(targetProfile?.status)}
                    </p>
                  </>
                }
              />
              <StatCard
                label="最終診断日"
                value={
                  <p className="text-[14px] font-black leading-5 md:text-lg md:leading-6">
                    {formatDisplayDate(
                      targetDiagnostic?.diagnosedAt || targetProfile?.lastDiagnosedAt
                    )}
                  </p>
                }
              />
            </div>
          </PanelFrame>

          {!hasDiagnosis && (
            <PanelFrame title="診断ステータス">
              <div className="rounded-[18px] border-[4px] border-black bg-[#111111] p-4 shadow-[0_5px_0_#000] md:rounded-[24px] md:p-6 md:shadow-[0_8px_0_#000]">
                <p className="text-[18px] font-black leading-tight text-[#ffe46a] md:text-2xl">
                  このユーザーにはまだ診断結果がありません
                </p>
                <p className="mt-2.5 text-[13px] font-bold leading-6 text-white/85 md:mt-4 md:text-sm md:leading-7">
                  診断が完了すると、詳細分析、AI解説、軸バランス、相性情報が表示されます。
                </p>
              </div>
            </PanelFrame>
          )}

          {hasDiagnosis && (
            <>
              <PanelFrame title="現在の診断結果">
                <div className="grid gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="MBTI"
                    value={
                      <>
                        <p className="text-[22px] font-black leading-none text-[#ffe46a] md:text-4xl">
                          {mbtiCode}
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                          {getMbtiTypeName(mbtiCode)}
                        </p>
                        <p className="mt-2 text-[12px] font-bold leading-5 text-white/70 md:mt-3 md:text-sm md:leading-6">
                          信頼度:{" "}
                          {typeof mbtiConfidence === "number"
                            ? `${mbtiConfidence}%`
                            : "-"}
                        </p>
                      </>
                    }
                  />

                  <StatCard
                    label="ビジネス人格"
                    value={
                      <>
                        <p className="text-[22px] font-black leading-none text-[#ffe46a] md:text-4xl">
                          {businessCode}
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-5 text-white/75 md:mt-2 md:text-sm md:leading-6">
                          {getBusinessTypeName(businessCode)}
                        </p>
                        <p className="mt-2 text-[12px] font-bold leading-5 text-white/70 md:mt-3 md:text-sm md:leading-6">
                          信頼度:{" "}
                          {typeof businessConfidence === "number"
                            ? `${businessConfidence}%`
                            : "-"}
                        </p>
                      </>
                    }
                  />

                  <StatCard
                    label="MBTI 境界軸"
                    value={
                      mbtiAmbiguity.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                        <p className="text-[14px] font-black md:text-lg">なし</p>
                      )
                    }
                  />

                  <StatCard
                    label="ビジネス人格 境界軸"
                    value={
                      businessAmbiguity.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                        <p className="text-[14px] font-black md:text-lg">なし</p>
                      )
                    }
                  />
                </div>
              </PanelFrame>

              <PanelFrame title="プロフィール見出し">
                <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                  <p className="text-[15px] font-black leading-6 text-[#ffe46a] md:text-lg md:leading-8">
                    {profileHeadlineText}
                  </p>
                </div>
              </PanelFrame>

              <PanelFrame title="扱い方ガイド">
                <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                  {actionGuideItems.map((item) => (
                    <div
                      key={item}
                      className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]"
                    >
                      <p className="text-[13px] font-bold leading-5 text-white/85 md:text-sm md:leading-7">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              {showCompatibility && directCompatibility && (
                <PanelFrame title="あなたとの相性">
                  <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[24px] md:p-5 md:shadow-[0_8px_0_#000]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div
                        className={`inline-flex rounded-full border-[3px] border-black px-2.5 py-1 text-[10px] font-black ${getCategoryBadgeClass(
                          directCompatibility.category
                        )} md:px-3 md:text-xs`}
                      >
                        {directCompatibility.categoryLabel}
                      </div>

                      {showScore && (
                        <div className="inline-flex rounded-full border-[3px] border-black bg-[#f3c400] px-2.5 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                          {directCompatibility.score}
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-[13px] font-bold leading-5 text-white/85 md:mt-4 md:text-sm md:leading-7">
                      {directCompatibility.summary}
                    </p>

                    <div className="mt-3 grid gap-3 md:mt-4 md:grid-cols-3 md:gap-4">
                      <ListCard
                        title="強み"
                        items={
                          directCompatibility.strengths.length > 0
                            ? directCompatibility.strengths
                            : ["関係性の強みデータがあります。"]
                        }
                      />
                      <ListCard
                        title="注意点"
                        items={
                          directCompatibility.risks.length > 0
                            ? directCompatibility.risks
                            : ["大きな衝突リスクは高くありません。"]
                        }
                      />
                      <ListCard
                        title="関わり方"
                        items={
                          directCompatibility.advice.length > 0
                            ? directCompatibility.advice
                            : ["最初に期待値を合わせると進めやすいです。"]
                        }
                      />
                    </div>
                  </div>
                </PanelFrame>
              )}

              <PanelFrame title="タイププロフィール">
                <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
                  <div className="grid gap-3 md:gap-4">
                    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border-[3px] border-black bg-white px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                          MBTI
                        </span>
                        <span className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                          {mbtiCode}
                        </span>
                      </div>

                      <p className="mt-2.5 text-[22px] font-black leading-tight text-[#ffe46a] md:mt-4 md:text-3xl">
                        {getMbtiTypeName(mbtiCode)}
                      </p>

                      <p className="mt-2.5 text-[13px] font-bold leading-5 text-white/85 md:mt-4 md:text-sm md:leading-7">
                        {mbtiCommentaryBlock?.body ||
                          "MBTIのプロファイル情報はまだありません。"}
                      </p>
                    </div>

                    <div className="grid gap-3 md:gap-4 md:grid-cols-3">
                      <InsightCard title="性格の核" body={mbtiCoreText} />
                      <InsightCard title="感情パターン" body={mbtiEmotionText} />
                      <InsightCard title="見落としやすい点" body={mbtiBlindSpotText} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:gap-4">
                    <div className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border-[3px] border-black bg-white px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                          ビジネス人格
                        </span>
                        <span className="rounded-full border-[3px] border-black bg-[#ffe46a] px-2 py-1 text-[10px] font-black text-black shadow-[0_3px_0_#000] md:px-3 md:text-xs md:shadow-[0_4px_0_#000]">
                          {businessCode}
                        </span>
                      </div>

                      <p className="mt-2.5 text-[22px] font-black leading-tight text-[#ffe46a] md:mt-4 md:text-3xl">
                        {commentary.businessProfile?.name ||
                          getBusinessTypeName(businessCode)}
                      </p>

                      <p className="mt-2.5 text-[13px] font-bold leading-5 text-white/85 md:mt-4 md:text-sm md:leading-7">
                        {businessCommentaryBlock?.body ||
                          commentary.businessProfile?.summary ||
                          "タイプの詳細情報はまだ設定されていません。"}
                      </p>
                    </div>

                    <div className="grid gap-3 md:gap-4 md:grid-cols-3">
                      <InsightCard title="仕事スタイル" body={businessWorkStyleText} />
                      <InsightCard title="価値の源泉" body={businessValueDriverText} />
                      <InsightCard
                        title="見落としやすい点"
                        body={businessBlindSpotText}
                      />
                    </div>

                    <div className="grid gap-3 md:gap-4 md:grid-cols-2">
                      <ListCard
                        title="強み"
                        items={normalizeList(commentary.businessProfile?.strengths)}
                      />
                      <ListCard
                        title="注意点"
                        items={normalizeList(commentary.businessProfile?.cautions)}
                      />
                    </div>
                  </div>
                </div>
              </PanelFrame>

              <PanelFrame title="AI解説">
                <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
                  {commentary.blocks.map((block) => (
                    <InsightCard
                      key={block.title}
                      title={block.title}
                      body={block.body}
                    />
                  ))}
                </div>
              </PanelFrame>

              <section className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
                <AxisPanel title="MBTI 軸バランス" axes={mbtiAxes} />
                <AxisPanel title="ビジネス人格 軸バランス" axes={businessAxes} />
              </section>

              <PanelFrame title="相性ガイド">
                <div className="grid gap-3 md:gap-4 lg:grid-cols-3">
                  <InsightCard
                    title={compatibilityGuide.fitTitle}
                    body={compatibilityGuide.fitBody}
                  />
                  <InsightCard
                    title={compatibilityGuide.cautionTitle}
                    body={compatibilityGuide.cautionBody}
                  />
                  <InsightCard
                    title={compatibilityGuide.adviceTitle}
                    body={compatibilityGuide.adviceBody}
                  />
                </div>
              </PanelFrame>
            </>
          )}

          <section
            className={`grid gap-3.5 md:gap-5 ${
              showCompatibility && hasDiagnosis
                ? "lg:grid-cols-[1.05fr_0.95fr]"
                : "lg:grid-cols-1"
            }`}
          >
            <div className="flex flex-col gap-3.5 md:gap-5">
              <PanelFrame title="フィードバック要約">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[18px] font-black leading-tight md:text-2xl">
                    フィードバック要約
                  </h2>
                  <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                    最新: {latestFeedbackDate}
                  </p>
                </div>

                {feedbackSectionSummaries.length === 0 ? (
                  <div className="mt-3 rounded-[14px] border-[3px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:mt-4 md:rounded-[18px] md:p-4 md:shadow-[0_6px_0_#000]">
                    <p className="text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-6">
                      まだ受信フィードバックがありません。
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 md:mt-5 md:gap-4">
                    {feedbackSectionSummaries.map((summary) => (
                      <div
                        key={summary.title}
                        className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-4 md:shadow-[0_8px_0_#000]"
                      >
                        <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                          {summary.title}
                        </p>
                        <ul className="mt-2 list-disc pl-5 text-[12px] font-bold leading-5 text-white/85 md:mt-3 md:text-sm md:leading-7">
                          {summary.contents.map((content, index) => (
                            <li key={`${summary.title}-${index}`}>{content}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </PanelFrame>

              <PanelFrame title="フィードバック一覧">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[18px] font-black leading-tight md:text-2xl">
                    フィードバック一覧
                  </h2>
                  <p className="text-[10px] font-black tracking-[0.12em] text-white/55 md:text-xs md:tracking-[0.15em]">
                    全 {feedbacks.length} 件
                  </p>
                </div>

                {latestFeedbacks.length === 0 ? (
                  <div className="mt-3 rounded-[14px] border-[3px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:mt-4 md:rounded-[18px] md:p-4 md:shadow-[0_6px_0_#000]">
                    <p className="text-[12px] font-bold leading-5 text-white/80 md:text-sm md:leading-6">
                      まだフィードバックがありません。
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 md:mt-5 md:gap-4">
                    {latestFeedbacks.map((fb) => (
                      <div
                        key={fb.id}
                        className="rounded-[16px] border-[4px] border-black bg-[#111111] p-3 shadow-[0_4px_0_#000] md:rounded-[22px] md:p-5 md:shadow-[0_8px_0_#000]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[15px] font-black leading-tight md:text-lg">
                              {fb.fromName}
                            </p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-white/70 md:text-sm md:leading-normal">
                              {fb.fromRole} / {fb.departmentName}
                            </p>
                          </div>
                          <p className="text-[10px] font-black tracking-[0.12em] text-white/50 md:text-xs md:tracking-[0.15em]">
                            {formatDisplayDate(fb.createdAt)}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-3 md:mt-4">
                          {extractFeedbackSections(fb).map((section) => (
                            <div
                              key={section.id}
                              className="rounded-[12px] border-[3px] border-black bg-[#1a1a1a] p-3 md:rounded-[16px] md:p-4"
                            >
                              <p className="text-[13px] font-black text-[#ffe46a] md:text-sm">
                                {section.title || "メモ"}
                              </p>
                              <p className="mt-1.5 whitespace-pre-wrap text-[13px] font-bold leading-5 text-white/85 md:mt-2 md:text-sm md:leading-7">
                                {section.content || "(未入力)"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelFrame>
            </div>

            {showCompatibility && hasDiagnosis && (
              <div className="flex flex-col gap-3.5 md:gap-5">
                <CompatibilityListPanel
                  title="良好関係"
                  headline="相性が良い人"
                  items={bestMatches}
                  emptyMessage="良好関係に該当する相手がまだいません。"
                  showScore={showScore}
                />

                <CompatibilityListPanel
                  title="補完関係"
                  headline="補完しやすい人"
                  items={supportMatches}
                  emptyMessage="補完関係に該当する相手がまだいません。"
                  showScore={showScore}
                />

                <CompatibilityListPanel
                  title="自分を広げてくれる相手"
                  headline="自分を広げてくれる相手"
                  items={stretchMatches}
                  emptyMessage="該当する相手がまだいません。"
                  showScore={showScore}
                />
              </div>
            )}
          </section>
        </div>
      </main>

      <P4BottomNav role={normalizedViewerRole} />
    </>
  );
}
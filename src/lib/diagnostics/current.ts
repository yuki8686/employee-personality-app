import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";

export type DiagnosticsForUi = {
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

type AxisResultDetail = {
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

type DiagnosticsCurrentDoc = {
  userId?: string;
  mbti?: {
    type?: string;
    typeName?: string;
    confidence?: number;
    strengths?: string[] | string;
    weaknesses?: string[] | string;
    traits?: string[] | string;
    axisResults?: Record<string, AxisResultDetail>;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    axisResults?: Record<string, AxisResultDetail>;
  };
  diagnosedAt?: string;
  availableRetakeAt?: string;
};

function normalizeAxisResults(
  axisResults?: Record<string, AxisResultDetail>
): Record<string, number> {
  const result: Record<string, number> = {};

  if (!axisResults) return result;

  for (const [key, value] of Object.entries(axisResults)) {
    const leftRatio =
      typeof value?.leftRatio === "number" ? value.leftRatio : 0.5;
    result[key] = Math.round(leftRatio * 100);
  }

  return result;
}

export async function getDiagnosticsForUi(
  userId: string
): Promise<DiagnosticsForUi | null> {
  if (!userId) return null;

  const snap = await getDoc(doc(db, "diagnostics_current", userId));
  if (!snap.exists()) return null;

  const data = snap.data() as DiagnosticsCurrentDoc;

  const mbtiCode = data.mbti?.type || "-";
  const businessCode = data.businessPersonality?.primaryType || "-";

  return {
    userId: data.userId || userId,
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
    mbtiAxisResults: normalizeAxisResults(data.mbti?.axisResults),
    businessAxisResults: normalizeAxisResults(
      data.businessPersonality?.axisResults
    ),
  };
}
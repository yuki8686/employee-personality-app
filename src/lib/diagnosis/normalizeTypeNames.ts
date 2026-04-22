import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";

type DiagnosticLike = {
  userId?: string;
  mbti?: {
    type?: string;
    typeName?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, unknown>;
  };
  businessPersonality?: {
    primaryType?: string;
    typeName?: string;
    confidence?: number;
    ambiguityAxes?: string[];
    axisResults?: Record<string, unknown>;
  };
  diagnosedAt?: string;
  updatedAt?: string;
};

export function normalizeDiagnosisTypeNames<T extends DiagnosticLike>(
  diagnostic: T | null | undefined
): T | null {
  if (!diagnostic) return null;

  const mbtiCode = diagnostic.mbti?.type || "";
  const businessCode = diagnostic.businessPersonality?.primaryType || "";

  return {
    ...diagnostic,
    mbti: diagnostic.mbti
      ? {
          ...diagnostic.mbti,
          typeName: mbtiCode ? getMbtiTypeName(mbtiCode) : diagnostic.mbti.typeName,
        }
      : diagnostic.mbti,
    businessPersonality: diagnostic.businessPersonality
      ? {
          ...diagnostic.businessPersonality,
          typeName: businessCode
            ? getBusinessTypeName(businessCode)
            : diagnostic.businessPersonality.typeName,
        }
      : diagnostic.businessPersonality,
  };
}

export function needsDiagnosisTypeNameBackfill(
  diagnostic: DiagnosticLike | null | undefined
): boolean {
  if (!diagnostic) return false;

  const mbtiCode = diagnostic.mbti?.type || "";
  const businessCode = diagnostic.businessPersonality?.primaryType || "";

  const normalizedMbtiName = mbtiCode ? getMbtiTypeName(mbtiCode) : "";
  const normalizedBusinessName = businessCode
    ? getBusinessTypeName(businessCode)
    : "";

  const currentMbtiName = diagnostic.mbti?.typeName || "";
  const currentBusinessName = diagnostic.businessPersonality?.typeName || "";

  const mbtiNeedsBackfill =
    !!mbtiCode && currentMbtiName !== "" && currentMbtiName !== normalizedMbtiName;

  const businessNeedsBackfill =
    !!businessCode &&
    (currentBusinessName === "" || currentBusinessName !== normalizedBusinessName);

  return mbtiNeedsBackfill || businessNeedsBackfill;
}

export function buildDiagnosisTypeNamePatch(
  diagnostic: DiagnosticLike | null | undefined
): Record<string, unknown> {
  if (!diagnostic) return {};

  const mbtiCode = diagnostic.mbti?.type || "";
  const businessCode = diagnostic.businessPersonality?.primaryType || "";

  const patch: Record<string, unknown> = {};

  if (mbtiCode) {
    patch["mbti.typeName"] = getMbtiTypeName(mbtiCode);
  }

  if (businessCode) {
    patch["businessPersonality.typeName"] = getBusinessTypeName(businessCode);
  }

  return patch;
}
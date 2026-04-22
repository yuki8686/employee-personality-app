type DiagnosticData = {
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

export type CompatibilityResult = {
  score: number;
  label: "excellent" | "good" | "neutral" | "warning";
  summary: string;
  reasons: string[];
};

const mbtiPairBonusMap: Record<string, number> = {
  ENFP_INFJ: 10,
  INFJ_ENFP: 10,
  ENTP_INTJ: 10,
  INTJ_ENTP: 10,
  ENFJ_INFP: 8,
  INFP_ENFJ: 8,
  ENTJ_INTP: 8,
  INTP_ENTJ: 8,
  ESTJ_ISFP: -6,
  ISFP_ESTJ: -6,
  ENTJ_ISFP: -8,
  ISFP_ENTJ: -8,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasMbti(value?: string): value is string {
  return typeof value === "string" && value.length === 4;
}

function hasBusiness(value?: string): value is string {
  return typeof value === "string" && value.length >= 4;
}

function calcMbtiLetterScore(a?: string, b?: string) {
  if (!hasMbti(a) || !hasMbti(b)) return 0;

  let score = 0;

  for (let i = 0; i < 4; i += 1) {
    if (a[i] === b[i]) {
      score += 4;
    }
  }

  const pairKey = `${a}_${b}`;
  score += mbtiPairBonusMap[pairKey] || 0;

  return score;
}

function calcMbtiComplementScore(a?: string, b?: string) {
  if (!hasMbti(a) || !hasMbti(b)) return 0;

  let score = 0;

  if (a[0] !== b[0]) score += 3; // E/I 補完
  if (a[1] !== b[1]) score += 4; // S/N 補完
  if (a[2] !== b[2]) score += 2; // T/F 補完
  if (a[3] !== b[3]) score += 2; // J/P 補完

  return score;
}

function calcAxisClosenessScore(
  a?: Record<string, number>,
  b?: Record<string, number>,
  keys: string[] = ["EI", "SN", "TF", "JP"]
) {
  if (!a || !b) return 0;

  let totalDistance = 0;
  let used = 0;

  for (const key of keys) {
    if (typeof a[key] !== "number" || typeof b[key] !== "number") continue;
    totalDistance += Math.abs(a[key] - b[key]);
    used += 1;
  }

  if (!used) return 0;

  const avgDistance = totalDistance / used;
  return Math.round(clamp(18 - avgDistance / 6, -8, 18));
}

function calcBusinessAxisScore(
  a?: Record<string, number>,
  b?: Record<string, number>
) {
  if (!a || !b) return 0;

  const keys = ["MP", "QR", "VT", "CS"];
  let score = 0;

  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    if (typeof av !== "number" || typeof bv !== "number") continue;

    const distance = Math.abs(av - bv);

    if (key === "MP") {
      // Manager / Player はある程度差がある方が補完しやすい
      if (distance >= 8) score += 10;
      else if (distance >= 4) score += 6;
      else score -= 2;
      continue;
    }

    if (key === "CS") {
      // Challenge / Safety は近すぎても遠すぎても微妙
      if (distance <= 3) score += 6;
      else if (distance <= 7) score += 4;
      else if (distance <= 12) score -= 1;
      else score -= 6;
      continue;
    }

    if (key === "QR" || key === "VT") {
      // 動機・価値観は近いほうが衝突しにくい
      if (distance <= 3) score += 8;
      else if (distance <= 7) score += 5;
      else if (distance <= 12) score -= 1;
      else score -= 7;
    }
  }

  return Math.round(score);
}

function calcConfidenceAdjustment(
  selfData: DiagnosticData,
  otherData: DiagnosticData
) {
  const selfConfidence =
    typeof selfData.confidence === "number" ? selfData.confidence : null;
  const otherConfidence =
    typeof otherData.confidence === "number" ? otherData.confidence : null;

  if (selfConfidence === null || otherConfidence === null) return 0;

  const avg = (selfConfidence + otherConfidence) / 2;

  if (avg >= 85) return 4;
  if (avg >= 70) return 2;
  if (avg >= 55) return 0;
  return -3;
}

function calcConflictPenalty(
  selfData: DiagnosticData,
  otherData: DiagnosticData
) {
  let penalty = 0;

  const selfMbti = selfData.mbti || "";
  const otherMbti = otherData.mbti || "";
  const selfBusiness = selfData.businessCode || "";
  const otherBusiness = otherData.businessCode || "";

  if (hasMbti(selfMbti) && hasMbti(otherMbti)) {
    // T/F が真逆で、かつ J/J だと衝突が固定化しやすい
    if (selfMbti[2] !== otherMbti[2] && selfMbti[3] === "J" && otherMbti[3] === "J") {
      penalty += 6;
    }

    // E/E かつ J/J は主導権競合しやすい
    if (selfMbti[0] === "E" && otherMbti[0] === "E" && selfMbti[3] === "J" && otherMbti[3] === "J") {
      penalty += 4;
    }

    // I/I かつ T/T は会話不足になりやすい
    if (selfMbti[0] === "I" && otherMbti[0] === "I" && selfMbti[2] === "T" && otherMbti[2] === "T") {
      penalty += 2;
    }
  }

  if (hasBusiness(selfBusiness) && hasBusiness(otherBusiness)) {
    // Manager 同士は役割競合しやすい
    if (selfBusiness[0] === "M" && otherBusiness[0] === "M") {
      penalty += 4;
    }

    // Challenge / Safety が真逆だと進め方で衝突しやすい
    if (selfBusiness[3] !== otherBusiness[3]) {
      penalty += 2;
    }

    // 価値観軸が真逆だと優先順位で揉めやすい
    if (selfBusiness[2] !== otherBusiness[2]) {
      penalty += 2;
    }
  }

  return penalty;
}

function pickTopReasonCandidates(
  selfData: DiagnosticData,
  otherData: DiagnosticData
) {
  const reasons: Array<{ text: string; weight: number }> = [];

  const selfMbti = selfData.mbti || "";
  const otherMbti = otherData.mbti || "";
  const selfBusiness = selfData.businessCode || "";
  const otherBusiness = otherData.businessCode || "";

  if (hasMbti(selfMbti) && hasMbti(otherMbti)) {
    if (selfMbti[0] === otherMbti[0]) {
      reasons.push({
        text: "対人エネルギーの出し方が近く、会話テンポを合わせやすい",
        weight: 6,
      });
    } else {
      reasons.push({
        text: "外向 / 内向の差が役割分担に活きやすく、補完関係を作りやすい",
        weight: 6,
      });
    }

    if (selfMbti[1] === otherMbti[1]) {
      reasons.push({
        text: "物事の捉え方が近く、認識のズレが起きにくい",
        weight: 7,
      });
    } else {
      reasons.push({
        text: "具体と発想の視点差があり、視野を広げやすい",
        weight: 5,
      });
    }

    if (selfMbti[2] === otherMbti[2]) {
      reasons.push({
        text: "判断基準が近く、意思決定でズレにくい",
        weight: 8,
      });
    } else {
      reasons.push({
        text: "判断基準が異なり、論理と配慮の補完が起きやすい",
        weight: 6,
      });
    }

    if (selfMbti[3] === otherMbti[3]) {
      reasons.push({
        text: "進め方のテンポが近く、仕事のリズムをそろえやすい",
        weight: 6,
      });
    } else {
      reasons.push({
        text: "計画性と柔軟性の差で、進め方に幅を持たせやすい",
        weight: 5,
      });
    }
  }

  if (hasBusiness(selfBusiness) && hasBusiness(otherBusiness)) {
    if (selfBusiness[0] !== otherBusiness[0]) {
      reasons.push({
        text: "リード役と実行役の補完が作りやすい",
        weight: 9,
      });
    } else {
      reasons.push({
        text: "役割スタイルが近く、連携の型を作りやすい",
        weight: 5,
      });
    }

    if (selfBusiness[1] === otherBusiness[1]) {
      reasons.push({
        text: "仕事の動機が近く、モチベーション設計を合わせやすい",
        weight: 7,
      });
    } else {
      reasons.push({
        text: "動機の違いがあるため、相手の原動力を理解すると強い",
        weight: 4,
      });
    }

    if (selfBusiness[2] === otherBusiness[2]) {
      reasons.push({
        text: "価値判断が近く、優先順位の認識をそろえやすい",
        weight: 8,
      });
    } else {
      reasons.push({
        text: "価値観の違いがあるため、判断基準の共有が重要になる",
        weight: 4,
      });
    }

    if (selfBusiness[3] !== otherBusiness[3]) {
      reasons.push({
        text: "攻めと安定のバランスが取れやすい",
        weight: 7,
      });
    } else {
      reasons.push({
        text: "リスクの取り方が近く、進め方の認識を合わせやすい",
        weight: 5,
      });
    }
  }

  return reasons;
}

function buildReasons(
  selfData: DiagnosticData,
  otherData: DiagnosticData
): string[] {
  return pickTopReasonCandidates(selfData, otherData)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((item) => item.text);
}

function buildSummary(
  label: CompatibilityResult["label"],
  selfData: DiagnosticData,
  otherData: DiagnosticData
) {
  const selfBusiness = selfData.businessCode || "";
  const otherBusiness = otherData.businessCode || "";
  const selfMbti = selfData.mbti || "";
  const otherMbti = otherData.mbti || "";

  const managerPlayerComplement =
    hasBusiness(selfBusiness) &&
    hasBusiness(otherBusiness) &&
    selfBusiness[0] !== otherBusiness[0];

  const tfDifferent =
    hasMbti(selfMbti) && hasMbti(otherMbti) && selfMbti[2] !== otherMbti[2];

  if (label === "excellent") {
    if (managerPlayerComplement) {
      return "かなり相性が良く、役割補完まで含めて強い協業が期待できる組み合わせです。";
    }
    return "かなり相性が良く、連携のテンポと判断の噛み合わせが作りやすい組み合わせです。";
  }

  if (label === "good") {
    if (tfDifferent) {
      return "相性は良好で、視点の違いを補完に変えやすい組み合わせです。";
    }
    return "相性は良好で、協力しやすい安定した組み合わせです。";
  }

  if (label === "warning") {
    if (managerPlayerComplement) {
      return "補完の余地はある一方で、進め方や判断基準の違いが衝突になりやすいため、役割整理が重要です。";
    }
    return "進め方の違いが衝突になりやすいため、役割整理と判断基準の共有が重要です。";
  }

  return "相性は中立ですが、役割分担とコミュニケーション設計次第で十分に機能する組み合わせです。";
}

export function calculateCompatibility(
  selfData: DiagnosticData,
  otherData: DiagnosticData
): CompatibilityResult {
  let score = 50;

  score += calcMbtiLetterScore(selfData.mbti, otherData.mbti);
  score += calcMbtiComplementScore(selfData.mbti, otherData.mbti);
  score += calcAxisClosenessScore(
    selfData.mbtiAxisResults,
    otherData.mbtiAxisResults,
    ["EI", "SN", "TF", "JP"]
  );
  score += calcBusinessAxisScore(
    selfData.businessAxisResults,
    otherData.businessAxisResults
  );
  score += calcConfidenceAdjustment(selfData, otherData);
  score -= calcConflictPenalty(selfData, otherData);

  score = clamp(Math.round(score), 0, 100);

  let label: CompatibilityResult["label"] = "neutral";
  if (score >= 82) label = "excellent";
  else if (score >= 66) label = "good";
  else if (score < 46) label = "warning";

  return {
    score,
    label,
    summary: buildSummary(label, selfData, otherData),
    reasons: buildReasons(selfData, otherData),
  };
}
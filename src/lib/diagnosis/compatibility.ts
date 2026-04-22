export type AxisResult = {
  rawScore: number;
  normalizedScore: number;
  side: string;
  confidence: number;
  isBorderline: boolean;
};

export type DiagnosticsCurrentDoc = {
  userId: string;
  mbti?: {
    type?: string;
    strengths?: string[];
    weaknesses?: string[];
    traits?: string[];
    axisResults?: Record<string, AxisResult>;
  };
  businessPersonality?: {
    primaryType?: string;
    secondaryType?: string;
    ambiguityAxes?: string[];
    typeName?: string;
    cluster?: string;
    summary?: string;
    communicationTips?: string[];
    cautions?: string[];
    axisResults?: Record<string, AxisResult>;
  };
  diagnosedAt?: string;
  availableRetakeAt?: string;
  historyVersion?: number;
  updatedAt?: string;
};

export type CompatibilityCategory = "good" | "complementary" | "challenging";

export type CompatibilityNarrative = {
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
};

export type CompatibilityResult = {
  score: number;
  confidence: number;
  category: CompatibilityCategory;
  categoryLabel: string;
  layerScores: {
    axisAffinity: number;
    roleComplement: number;
    riskPenalty: number;
    typeNarrativeBonus: number;
    behaviorEvidence: number;
  };
  businessTypePair: string;
  mbtiPair: string;
  clusterPair: string;
  matchedTags: string[];
  conflictFlags: string[];
  complementFlags: string[];
  summary: string;
  strengths: string[];
  risks: string[];
  advice: string[];
};

type TypeTagMap = Record<string, string[]>;

const SIMILARITY_AXES = ["EI", "SN"] as const;
const COMPLEMENT_AXES = ["TF", "JP", "MP", "QR", "VT", "CS"] as const;
const ALL_AXES = [...SIMILARITY_AXES, ...COMPLEMENT_AXES] as const;

const TYPE_TAGS: TypeTagMap = {
  MQVC: [
    "front_leader",
    "vision_driven",
    "fast_decision",
    "can_be_dominant",
    "weak_systemization",
  ],
  MRVC: [
    "team_driver",
    "alignment_builder",
    "motivator",
    "delegation_strong",
  ],
  PQVC: [
    "independent_diver",
    "deep_focus",
    "creative_push",
    "solo_strong",
  ],
  PRVC: [
    "field_ace",
    "crisis_response",
    "quick_action",
    "practical_push",
  ],
  MQTC: [
    "strategic_commander",
    "high_logic",
    "big_picture",
    "structured_drive",
  ],
  MRTC: [
    "result_manager",
    "sharp_judgement",
    "competitive",
    "resource_allocator",
  ],
  PQTC: [
    "speed_runner",
    "agile_executor",
    "trial_fast",
    "independent_action",
  ],
  PRTC: [
    "opportunity_hunter",
    "decisive_mover",
    "profit_sense",
    "timing_strong",
  ],
  MQVS: [
    "quality_architect",
    "ideal_quality",
    "careful_build",
    "slow_but_strong",
  ],
  MRVS: [
    "trust_builder",
    "friction_absorber",
    "high_listening",
    "high_adjustment",
  ],
  PQVS: [
    "steady_crafter",
    "deep_work",
    "persistent",
    "quiet_growth",
  ],
  PRVS: [
    "scene_coordinator",
    "supportive_operator",
    "stable_response",
    "practical_adjuster",
  ],
  MQTS: [
    "last_guard",
    "system_guardian",
    "careful_decision",
    "stability_first",
  ],
  MRTS: [
    "solid_producer",
    "balanced_manager",
    "reliable_planner",
    "safe_growth",
  ],
  PQTS: [
    "trust_guardian",
    "steady_support",
    "patient_worker",
    "long_term_fit",
  ],
  PRTS: [
    "efficiency_master",
    "time_performance",
    "practical_speed",
    "waste_hater",
  ],
};

const CLUSTER_MATRIX: Record<string, number> = {
  "challenge-challenge": 2,
  "challenge-strategy": 6,
  "challenge-craft": 1,
  "challenge-harmony": -2,
  "strategy-challenge": 6,
  "strategy-strategy": 3,
  "strategy-craft": 4,
  "strategy-harmony": 1,
  "craft-challenge": 1,
  "craft-strategy": 4,
  "craft-craft": 2,
  "craft-harmony": 3,
  "harmony-challenge": -2,
  "harmony-strategy": 1,
  "harmony-craft": 3,
  "harmony-harmony": 2,
};

const TAG_INTERACTIONS: Record<string, number> = {
  "front_leader|friction_absorber": 7,
  "friction_absorber|front_leader": 7,
  "vision_driven|system_guardian": 4,
  "system_guardian|vision_driven": 4,
  "big_picture|practical_adjuster": 4,
  "practical_adjuster|big_picture": 4,
  "deep_work|alignment_builder": 3,
  "alignment_builder|deep_work": 3,
  "fast_decision|high_adjustment": 4,
  "high_adjustment|fast_decision": 4,
  "fast_decision|system_guardian": -4,
  "system_guardian|fast_decision": -4,
  "can_be_dominant|can_be_dominant": -5,
  "quick_action|careful_decision": -3,
  "careful_decision|quick_action": -3,
  "efficiency_master|trust_builder": 3,
  "trust_builder|efficiency_master": 3,
};

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function round(value: number) {
  return Math.round(value);
}

function getMbtiAxis(diag: DiagnosticsCurrentDoc, axisKey: string) {
  return diag.mbti?.axisResults?.[axisKey];
}

function getBusinessAxis(diag: DiagnosticsCurrentDoc, axisKey: string) {
  return diag.businessPersonality?.axisResults?.[axisKey];
}

function getAxis(diag: DiagnosticsCurrentDoc, axisKey: string) {
  if (["EI", "SN", "TF", "JP"].includes(axisKey)) {
    return getMbtiAxis(diag, axisKey);
  }
  return getBusinessAxis(diag, axisKey);
}

function getAxisNormalizedScore(diag: DiagnosticsCurrentDoc, axisKey: string): number {
  return getAxis(diag, axisKey)?.normalizedScore ?? 0;
}

function getAxisConfidence(diag: DiagnosticsCurrentDoc, axisKey: string): number {
  return getAxis(diag, axisKey)?.confidence ?? 0;
}

function getAxisConfidenceSafe(diag: DiagnosticsCurrentDoc, axisKey: string): number {
  const value = getAxisConfidence(diag, axisKey);
  return value > 0 ? value : 50;
}

function getAverageConfidence(diag: DiagnosticsCurrentDoc): number {
  const values = ALL_AXES.map((key) => getAxisConfidenceSafe(diag, key));
  if (values.length === 0) return 50;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getBorderlinePenalty(diag: DiagnosticsCurrentDoc, axisKey: string): number {
  return getAxis(diag, axisKey)?.isBorderline ? 0.9 : 1;
}

function calcSimilarityScore(a: number, b: number): number {
  const distance = Math.abs(a - b);
  return clamp(0, round(100 - distance), 100);
}

function calcBalancedComplementScore(a: number, b: number): number {
  const distance = Math.abs(a - b);

  if (distance <= 8) return 42;
  if (distance <= 18) return 56;
  if (distance <= 32) return 78;
  if (distance <= 48) return 96;
  if (distance <= 64) return 78;
  if (distance <= 78) return 58;
  return 38;
}

function applyAxisReliability(
  baseScore: number,
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc,
  axisKey: string
) {
  const confidenceWeight =
    Math.min(
      getAxisConfidenceSafe(left, axisKey),
      getAxisConfidenceSafe(right, axisKey)
    ) / 100;

  const borderlinePenalty =
    getBorderlinePenalty(left, axisKey) * getBorderlinePenalty(right, axisKey);

  return round(baseScore * confidenceWeight * borderlinePenalty);
}

function calcAxisAffinity(
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc
): {
  score: number;
  axisScores: Record<string, number>;
} {
  const axisScores: Record<string, number> = {};

  for (const axis of SIMILARITY_AXES) {
    const base = calcSimilarityScore(
      getAxisNormalizedScore(left, axis),
      getAxisNormalizedScore(right, axis)
    );

    axisScores[axis] = applyAxisReliability(base, left, right, axis);
  }

  for (const axis of COMPLEMENT_AXES) {
    const base = calcBalancedComplementScore(
      getAxisNormalizedScore(left, axis),
      getAxisNormalizedScore(right, axis)
    );

    axisScores[axis] = applyAxisReliability(base, left, right, axis);
  }

  const values = Object.values(axisScores);
  const score =
    values.length > 0
      ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;

  return {
    score,
    axisScores,
  };
}

function calcRoleComplement(
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc
): {
  score: number;
  complementFlags: string[];
} {
  const complementFlags: string[] = [];

  const tfScore = applyAxisReliability(
    calcBalancedComplementScore(
      getAxisNormalizedScore(left, "TF"),
      getAxisNormalizedScore(right, "TF")
    ),
    left,
    right,
    "TF"
  );

  const jpScore = applyAxisReliability(
    calcBalancedComplementScore(
      getAxisNormalizedScore(left, "JP"),
      getAxisNormalizedScore(right, "JP")
    ),
    left,
    right,
    "JP"
  );

  const mpScore = applyAxisReliability(
    calcBalancedComplementScore(
      getAxisNormalizedScore(left, "MP"),
      getAxisNormalizedScore(right, "MP")
    ),
    left,
    right,
    "MP"
  );

  const vtScore = applyAxisReliability(
    calcBalancedComplementScore(
      getAxisNormalizedScore(left, "VT"),
      getAxisNormalizedScore(right, "VT")
    ),
    left,
    right,
    "VT"
  );

  if (tfScore >= 80) complementFlags.push("tf_logic_care_complement");
  if (jpScore >= 80) complementFlags.push("jp_plan_flex_complement");
  if (mpScore >= 80) complementFlags.push("mp_role_complement");
  if (vtScore >= 80) complementFlags.push("vt_meaning_condition_complement");

  const score = round((tfScore + jpScore + mpScore + vtScore) / 4);

  return {
    score,
    complementFlags,
  };
}

function calcRiskPenalty(
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc
): {
  score: number;
  conflictFlags: string[];
} {
  const conflictFlags: string[] = [];

  const csGap = Math.abs(
    getAxisNormalizedScore(left, "CS") - getAxisNormalizedScore(right, "CS")
  );
  const tfGap = Math.abs(
    getAxisNormalizedScore(left, "TF") - getAxisNormalizedScore(right, "TF")
  );
  const vtGap = Math.abs(
    getAxisNormalizedScore(left, "VT") - getAxisNormalizedScore(right, "VT")
  );
  const mpGap = Math.abs(
    getAxisNormalizedScore(left, "MP") - getAxisNormalizedScore(right, "MP")
  );

  let csConflict = clamp(0, round((csGap / 100) * 100), 100);
  let tfConflict = clamp(0, round((tfGap / 100) * 100), 100);
  let vtConflict = clamp(0, round((vtGap / 100) * 100), 100);
  let mpConflict = clamp(0, round((mpGap / 100) * 100), 100);

  csConflict = round(
    csConflict *
      (2 - Math.min(getAxisConfidenceSafe(left, "CS"), getAxisConfidenceSafe(right, "CS")) / 100)
  );
  tfConflict = round(
    tfConflict *
      (2 - Math.min(getAxisConfidenceSafe(left, "TF"), getAxisConfidenceSafe(right, "TF")) / 100)
  );
  vtConflict = round(
    vtConflict *
      (2 - Math.min(getAxisConfidenceSafe(left, "VT"), getAxisConfidenceSafe(right, "VT")) / 100)
  );
  mpConflict = round(
    mpConflict *
      (2 - Math.min(getAxisConfidenceSafe(left, "MP"), getAxisConfidenceSafe(right, "MP")) / 100)
  );

  if (csGap >= 70) conflictFlags.push("cs_extreme_gap");
  if (tfGap >= 70) conflictFlags.push("tf_extreme_gap");
  if (vtGap >= 70) conflictFlags.push("vt_extreme_gap");
  if (mpGap >= 70) conflictFlags.push("mp_extreme_gap");

  const score = round(
    csConflict * 0.35 +
      tfConflict * 0.3 +
      vtConflict * 0.2 +
      mpConflict * 0.15
  );

  return {
    score: clamp(0, score, 100),
    conflictFlags,
  };
}

function getTypeTags(typeCode?: string): string[] {
  if (!typeCode) return [];
  return TYPE_TAGS[typeCode] || [];
}

function calcNarrativeScore(
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc
): {
  score: number;
  matchedTags: string[];
} {
  const matchedTags: string[] = [];

  const leftType = left.businessPersonality?.primaryType || "";
  const rightType = right.businessPersonality?.primaryType || "";
  const leftMbti = left.mbti?.type || "";
  const rightMbti = right.mbti?.type || "";
  const leftCluster = left.businessPersonality?.cluster || "";
  const rightCluster = right.businessPersonality?.cluster || "";

  let score = 0;

  if (leftType && rightType && leftType === rightType) {
    score += 8;
    matchedTags.push("same_business_type");
  }

  if (leftMbti && rightMbti && leftMbti === rightMbti) {
    score += 3;
    matchedTags.push("same_mbti");
  }

  if (leftCluster && rightCluster && leftCluster === rightCluster) {
    score += 4;
    matchedTags.push("same_cluster");
  }

  const clusterKey = `${leftCluster}-${rightCluster}`;
  const clusterScore = CLUSTER_MATRIX[clusterKey] || 0;
  if (clusterScore !== 0) {
    score += clusterScore;
    matchedTags.push(`cluster:${clusterKey}`);
  }

  const leftTags = getTypeTags(leftType);
  const rightTags = getTypeTags(rightType);

  for (const tagA of leftTags) {
    for (const tagB of rightTags) {
      const interactionKey = `${tagA}|${tagB}`;
      const delta = TAG_INTERACTIONS[interactionKey];
      if (typeof delta === "number" && delta !== 0) {
        score += delta;
        matchedTags.push(`tag:${tagA}:${tagB}`);
      }
    }
  }

  return {
    score: clamp(-20, score, 20),
    matchedTags,
  };
}

function calcBehaviorScore(): number {
  return 0;
}

function getCategory(finalScore: number, riskPenalty: number): CompatibilityCategory {
  if (finalScore >= 80 && riskPenalty < 18) return "good";
  if (finalScore >= 55) return "complementary";
  return "challenging";
}

function getCategoryLabel(category: CompatibilityCategory) {
  if (category === "good") return "良好関係";
  if (category === "complementary") return "補完関係";
  return "挑戦関係";
}

function buildNarrative(input: {
  finalScore: number;
  category: CompatibilityCategory;
  axisAffinity: Record<string, number>;
  complementFlags: string[];
  conflictFlags: string[];
  typePair: [string, string];
  typeTagsA: string[];
  typeTagsB: string[];
  clusterPair: [string, string];
}): CompatibilityNarrative {
  const {
    category,
    axisAffinity,
    complementFlags,
    conflictFlags,
    typeTagsA,
    typeTagsB,
    clusterPair,
  } = input;

  const strengths: string[] = [];
  const risks: string[] = [];
  const advice: string[] = [];

  if ((axisAffinity.EI ?? 0) >= 75 && (axisAffinity.SN ?? 0) >= 75) {
    strengths.push("会話のテンポと物事の捉え方が噛み合いやすい関係です。");
  }

  if (complementFlags.includes("mp_role_complement")) {
    strengths.push("設計と実行の役割分担がしやすく、協働で力を出しやすいです。");
  }

  if (complementFlags.includes("vt_meaning_condition_complement")) {
    strengths.push("意味づけと条件整理の視点を持ち寄れるため、判断の質が上がりやすいです。");
  }

  if (complementFlags.includes("tf_logic_care_complement")) {
    strengths.push("論理と配慮のバランスが取りやすく、周囲を巻き込みやすいです。");
  }

  if (complementFlags.includes("jp_plan_flex_complement")) {
    strengths.push("計画性と柔軟性を補い合いやすく、進行が安定しやすいです。");
  }

  if (conflictFlags.includes("cs_extreme_gap")) {
    risks.push("変化への向き合い方に差があり、判断スピードで摩擦が起きやすい可能性があります。");
  }

  if (conflictFlags.includes("tf_extreme_gap")) {
    risks.push("論理重視と配慮重視の差で、伝え方のズレが起きやすい可能性があります。");
  }

  if (conflictFlags.includes("vt_extreme_gap")) {
    risks.push("意味重視と条件重視の差で、優先順位がズレやすい可能性があります。");
  }

  if (conflictFlags.includes("mp_extreme_gap")) {
    risks.push("主導の取り方や役割期待に差があり、噛み合うまでに調整が必要です。");
  }

  if (category === "good") {
    advice.push("最初にゴールだけ合わせると、自然に役割が噛み合いやすくなります。");
  } else if (category === "complementary") {
    advice.push("方針担当と実行担当を先に分けると、補完関係が活きやすくなります。");
  } else {
    advice.push("最初に期待値、判断基準、進め方の順で合意すると安定しやすくなります。");
  }

  if (
    typeTagsA.includes("can_be_dominant") &&
    typeTagsB.includes("can_be_dominant")
  ) {
    risks.push("どちらも主導権を握りやすく、意思決定の場面でぶつかる可能性があります。");
    advice.push("意思決定者を先に決めると衝突を減らしやすくなります。");
  }

  if (
    clusterPair[0] === "challenge" &&
    clusterPair[1] === "strategy"
  ) {
    strengths.push("前進力と設計力の補完が働きやすい組み合わせです。");
  }

  if (
    clusterPair[0] === "challenge" &&
    clusterPair[1] === "harmony"
  ) {
    risks.push("推進スピードと安定志向の差が、温度差として表れやすいです。");
  }

  if (strengths.length === 0) {
    strengths.push("前提を丁寧に共有すると、強みを引き出しやすい関係です。");
  }

  if (risks.length === 0) {
    risks.push("大きな衝突リスクは高くありませんが、役割の曖昧さには注意が必要です。");
  }

  const summary =
    category === "good"
      ? "役割補完と価値観のバランスが良く、協働しやすい関係です。"
      : category === "complementary"
      ? "違いを補い合うことで強みを出しやすい関係です。"
      : "考え方や進め方に差があり、すり合わせを丁寧に行うと活きやすい関係です。";

  return {
    summary,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    advice: advice.slice(0, 3),
  };
}

export function calculateCompatibilityFromCurrentDocs(
  left: DiagnosticsCurrentDoc,
  right: DiagnosticsCurrentDoc
): CompatibilityResult {
  const axisAffinity = calcAxisAffinity(left, right);
  const roleComplement = calcRoleComplement(left, right);
  const riskPenalty = calcRiskPenalty(left, right);
  const narrativeScore = calcNarrativeScore(left, right);
  const behaviorScore = calcBehaviorScore();

  const baseScore = round(
    axisAffinity.score * 0.28 +
      roleComplement.score * 0.24 +
      (100 - riskPenalty.score) * 0.18 +
      (50 + narrativeScore.score * 2.5) * 0.12 +
      behaviorScore * 0.18
  );

  const confidence = round(
    (getAverageConfidence(left) + getAverageConfidence(right)) / 2
  );

  const normalizedFinalScore = clamp(
    0,
    round(baseScore * (confidence / 100)),
    100
  );

  const category = getCategory(normalizedFinalScore, riskPenalty.score);
  const categoryLabel = getCategoryLabel(category);

  const leftType = left.businessPersonality?.primaryType || "";
  const rightType = right.businessPersonality?.primaryType || "";
  const leftTags = getTypeTags(leftType);
  const rightTags = getTypeTags(rightType);

  const narrative = buildNarrative({
    finalScore: normalizedFinalScore,
    category,
    axisAffinity: axisAffinity.axisScores,
    complementFlags: roleComplement.complementFlags,
    conflictFlags: riskPenalty.conflictFlags,
    typePair: [leftType, rightType],
    typeTagsA: leftTags,
    typeTagsB: rightTags,
    clusterPair: [
      left.businessPersonality?.cluster || "",
      right.businessPersonality?.cluster || "",
    ],
  });

  return {
    score: normalizedFinalScore,
    confidence,
    category,
    categoryLabel,
    layerScores: {
      axisAffinity: axisAffinity.score,
      roleComplement: roleComplement.score,
      riskPenalty: riskPenalty.score,
      typeNarrativeBonus: narrativeScore.score,
      behaviorEvidence: behaviorScore,
    },
    businessTypePair: `${left.businessPersonality?.primaryType || ""}-${right.businessPersonality?.primaryType || ""}`,
    mbtiPair: `${left.mbti?.type || ""}-${right.mbti?.type || ""}`,
    clusterPair: `${left.businessPersonality?.cluster || ""}-${right.businessPersonality?.cluster || ""}`,
    matchedTags: narrativeScore.matchedTags,
    conflictFlags: riskPenalty.conflictFlags,
    complementFlags: roleComplement.complementFlags,
    summary: narrative.summary,
    strengths: narrative.strengths,
    risks: narrative.risks,
    advice: narrative.advice,
  };
}
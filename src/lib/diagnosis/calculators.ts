import type {
  AxisDirection,
  AxisScore,
  BusinessAnswer,
  BusinessAxisKey,
  BusinessQuestion,
  BusinessResult,
  LikertValue,
  MbtiAnswer,
  MbtiAxisKey,
  MbtiQuestion,
  MbtiResult,
} from "@/lib/diagnosis/types";

const MBTI_AXIS_MAP: Record<
  MbtiAxisKey,
  { left: "E" | "S" | "T" | "J"; right: "I" | "N" | "F" | "P" }
> = {
  EI: { left: "E", right: "I" },
  SN: { left: "S", right: "N" },
  TF: { left: "T", right: "F" },
  JP: { left: "J", right: "P" },
};

const BUSINESS_AXIS_MAP: Record<
  BusinessAxisKey,
  { left: "M" | "Q" | "V" | "C"; right: "P" | "R" | "T" | "S" }
> = {
  MP: { left: "M", right: "P" },
  QR: { left: "Q", right: "R" },
  VT: { left: "V", right: "T" },
  CS: { left: "C", right: "S" },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getLikertDirectionScore(value: LikertValue): number {
  if (value === 5) return 2;
  if (value === 4) return 1;
  if (value === 3) return 0;
  if (value === 2) return -1;
  return -2;
}

function getLikertEvidenceStrength(value: LikertValue): number {
  if (value === 3) return 0;
  if (value === 4 || value === 2) return 1;
  return 2;
}

function buildAxisScore(params: {
  leftKey: AxisDirection;
  rightKey: AxisDirection;
  leftScore: number;
  rightScore: number;
  answeredCount: number;
  neutralCount: number;
  totalWeight: number;
  signedScore: number;
  isBorderline: boolean;
}): AxisScore {
  const {
    leftKey,
    rightKey,
    leftScore,
    rightScore,
    answeredCount,
    neutralCount,
    totalWeight,
    signedScore,
    isBorderline,
  } = params;

  const total = leftScore + rightScore;
  const leftRatio = total === 0 ? 0.5 : leftScore / total;
  const rightRatio = total === 0 ? 0.5 : rightScore / total;
  const difference = Math.abs(leftScore - rightScore);
  const dominant: AxisDirection = leftScore >= rightScore ? leftKey : rightKey;
  const neutralRate = answeredCount === 0 ? 0 : neutralCount / answeredCount;

  return {
    leftKey,
    rightKey,
    leftScore: round(leftScore),
    rightScore: round(rightScore),
    leftRatio: round(leftRatio),
    rightRatio: round(rightRatio),
    difference: round(difference),
    dominant,
    isBorderline,
    answeredCount,
    neutralCount,
    neutralRate: round(neutralRate),
    totalWeight: round(totalWeight),
    signedScore: round(signedScore),
  };
}

function getLikertAxisStats(params: {
  leftScore: number;
  rightScore: number;
  answeredCount: number;
  neutralCount: number;
  totalQuestionCount: number;
  totalWeight: number;
}) {
  const {
    leftScore,
    rightScore,
    answeredCount,
    neutralCount,
    totalQuestionCount,
    totalWeight,
  } = params;

  const totalEvidence = leftScore + rightScore;
  const difference = Math.abs(leftScore - rightScore);
  const marginRate = totalEvidence === 0 ? 0 : difference / totalEvidence;
  const neutralRate = answeredCount === 0 ? 1 : neutralCount / answeredCount;
  const completionRate =
    totalQuestionCount === 0 ? 0 : answeredCount / totalQuestionCount;
  const weightedEvidenceRate =
    totalWeight === 0 ? 0 : totalEvidence / Math.max(totalWeight, 1);

  return {
    totalEvidence,
    difference,
    marginRate,
    neutralRate,
    completionRate,
    weightedEvidenceRate,
  };
}

function shouldMarkLikertAxisAsBorderline(params: {
  leftScore: number;
  rightScore: number;
  answeredCount: number;
  neutralCount: number;
  totalQuestionCount: number;
  totalWeight: number;
}): boolean {
  const stats = getLikertAxisStats(params);

  if (stats.totalEvidence === 0) {
    return true;
  }

  if (params.answeredCount <= 2) {
    return true;
  }

  if (stats.completionRate < 0.65) {
    return true;
  }

  if (stats.weightedEvidenceRate < 0.55) {
    return true;
  }

  if (stats.marginRate <= 0.1) {
    return true;
  }

  if (stats.marginRate <= 0.15 && stats.neutralRate >= 0.2) {
    return true;
  }

  if (stats.marginRate <= 0.2 && stats.neutralRate >= 0.35) {
    return true;
  }

  if (stats.marginRate <= 0.26 && stats.neutralRate >= 0.5) {
    return true;
  }

  return false;
}

function getBinaryAxisStats(params: {
  leftScore: number;
  rightScore: number;
  answeredCount: number;
  totalQuestionCount: number;
  totalWeight: number;
}) {
  const {
    leftScore,
    rightScore,
    answeredCount,
    totalQuestionCount,
    totalWeight,
  } = params;

  const totalEvidence = leftScore + rightScore;
  const difference = Math.abs(leftScore - rightScore);
  const marginRate = totalEvidence === 0 ? 0 : difference / totalEvidence;
  const completionRate =
    totalQuestionCount === 0 ? 0 : answeredCount / totalQuestionCount;
  const weightedEvidenceRate =
    totalWeight === 0 ? 0 : totalEvidence / Math.max(totalWeight, 1);

  return {
    totalEvidence,
    difference,
    marginRate,
    completionRate,
    weightedEvidenceRate,
  };
}

function shouldMarkBinaryAxisAsBorderline(params: {
  leftScore: number;
  rightScore: number;
  answeredCount: number;
  totalQuestionCount: number;
  totalWeight: number;
}): boolean {
  const stats = getBinaryAxisStats(params);

  if (stats.totalEvidence === 0) {
    return true;
  }

  if (params.answeredCount <= 2) {
    return true;
  }

  if (stats.completionRate < 0.65) {
    return true;
  }

  if (stats.weightedEvidenceRate < 0.7) {
    return true;
  }

  if (stats.difference <= 1) {
    return true;
  }

  if (stats.marginRate <= 0.15) {
    return true;
  }

  if (params.answeredCount <= 4 && stats.marginRate <= 0.25) {
    return true;
  }

  return false;
}

function analyzeLikertResponseStyle(answers: MbtiAnswer[]) {
  const values = answers
    .map((item) => item.value)
    .filter((value): value is LikertValue => value >= 1 && value <= 5);

  const total = values.length;
  if (total === 0) {
    return {
      total: 0,
      neutralRate: 0,
      extremeRate: 0,
      positiveRate: 0,
      negativeRate: 0,
      directionalBias: 0,
      straightliningRisk: 0,
    };
  }

  const neutralCount = values.filter((value) => value === 3).length;
  const extremeCount = values.filter((value) => value === 1 || value === 5).length;
  const positiveCount = values.filter((value) => value >= 4).length;
  const negativeCount = values.filter((value) => value <= 2).length;

  const signedSum = values.reduce(
    (sum, value) => sum + getLikertDirectionScore(value),
    0
  );

  const neutralRate = neutralCount / total;
  const extremeRate = extremeCount / total;
  const positiveRate = positiveCount / total;
  const negativeRate = negativeCount / total;
  const directionalBias = signedSum / (total * 2);

  let straightliningRisk = 0;
  if (positiveRate >= 0.8 || negativeRate >= 0.8) {
    straightliningRisk += 0.08;
  }
  if (extremeRate >= 0.7) {
    straightliningRisk += 0.06;
  }
  if (neutralRate >= 0.55) {
    straightliningRisk += 0.05;
  }

  return {
    total,
    neutralRate,
    extremeRate,
    positiveRate,
    negativeRate,
    directionalBias: round(directionalBias),
    straightliningRisk: round(straightliningRisk),
  };
}

function getLikertStyleAdjustedWeight(params: {
  value: LikertValue;
  baseDirectionScore: number;
  baseWeight: number;
  style: ReturnType<typeof analyzeLikertResponseStyle>;
}) {
  const { value, baseDirectionScore, baseWeight, style } = params;

  let multiplier = 1;

  if (value === 3) {
    return 0;
  }

  if (style.extremeRate >= 0.7 && (value === 1 || value === 5)) {
    multiplier *= 0.9;
  } else if (style.extremeRate >= 0.55 && (value === 1 || value === 5)) {
    multiplier *= 0.95;
  }

  if (style.neutralRate >= 0.45 && (value === 4 || value === 2)) {
    multiplier *= 0.95;
  }

  if (style.directionalBias >= 0.35 && baseDirectionScore > 0) {
    multiplier *= 0.9;
  } else if (style.directionalBias <= -0.35 && baseDirectionScore < 0) {
    multiplier *= 0.9;
  } else if (Math.abs(style.directionalBias) >= 0.22) {
    if (
      (style.directionalBias > 0 && baseDirectionScore > 0) ||
      (style.directionalBias < 0 && baseDirectionScore < 0)
    ) {
      multiplier *= 0.95;
    }
  }

  multiplier *= 1 - style.straightliningRisk;

  return round(baseWeight * clamp(multiplier, 0.72, 1));
}

function analyzeBinaryResponseStyle(answers: BusinessAnswer[]) {
  const values = answers
    .map((item) => item.answer)
    .filter((value): value is "A" | "B" => value === "A" || value === "B");

  const total = values.length;
  if (total === 0) {
    return {
      total: 0,
      aRate: 0,
      bRate: 0,
      dominantRate: 0,
      straightliningRisk: 0,
    };
  }

  const aCount = values.filter((value) => value === "A").length;
  const bCount = total - aCount;
  const aRate = aCount / total;
  const bRate = bCount / total;
  const dominantRate = Math.max(aRate, bRate);

  let straightliningRisk = 0;
  if (dominantRate >= 0.9) {
    straightliningRisk = 0.12;
  } else if (dominantRate >= 0.8) {
    straightliningRisk = 0.07;
  } else if (dominantRate >= 0.72) {
    straightliningRisk = 0.04;
  }

  return {
    total,
    aRate: round(aRate),
    bRate: round(bRate),
    dominantRate: round(dominantRate),
    straightliningRisk: round(straightliningRisk),
  };
}

function getBinaryStyleAdjustedWeight(params: {
  baseWeight: number;
  style: ReturnType<typeof analyzeBinaryResponseStyle>;
}) {
  const { baseWeight, style } = params;

  const multiplier = clamp(1 - style.straightliningRisk, 0.82, 1);
  return round(baseWeight * multiplier);
}

export function calculateMbtiType(
  questions: MbtiQuestion[],
  answers: MbtiAnswer[]
): MbtiResult {
  const answerMap = new Map(answers.map((item) => [item.questionId, item.value]));
  const responseStyle = analyzeLikertResponseStyle(answers);

  const questionsByAxis: Record<MbtiAxisKey, number> = {
    EI: 0,
    SN: 0,
    TF: 0,
    JP: 0,
  };

  for (const question of questions) {
    questionsByAxis[question.axis] += 1;
  }

  const raw = {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0,
  };

  const axisMeta: Record<
    MbtiAxisKey,
    {
      answeredCount: number;
      neutralCount: number;
      totalWeight: number;
      signedScore: number;
    }
  > = {
    EI: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    SN: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    TF: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    JP: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
  };

  for (const question of questions) {
    const value = answerMap.get(question.id);
    if (!value) continue;

    const axisPair = MBTI_AXIS_MAP[question.axis];
    const meta = axisMeta[question.axis];

    meta.answeredCount += 1;
    meta.totalWeight += question.weight;

    if (value === 3) {
      meta.neutralCount += 1;
      continue;
    }

    const baseDirectionScore = getLikertDirectionScore(value);
    const orientedScore = question.reverse ? -baseDirectionScore : baseDirectionScore;

    const adjustedWeight = getLikertStyleAdjustedWeight({
      value,
      baseDirectionScore,
      baseWeight: question.weight,
      style: responseStyle,
    });

    const evidenceStrength = getLikertEvidenceStrength(value);
    const weightedSignedScore =
      Math.sign(orientedScore) * evidenceStrength * adjustedWeight;

    meta.signedScore += weightedSignedScore;

    if (weightedSignedScore > 0) {
      raw[axisPair.left] += weightedSignedScore;
    } else if (weightedSignedScore < 0) {
      raw[axisPair.right] += Math.abs(weightedSignedScore);
    }
  }

  const axisScores: Record<MbtiAxisKey, AxisScore> = {
    EI: buildAxisScore({
      leftKey: "E",
      rightKey: "I",
      leftScore: raw.E,
      rightScore: raw.I,
      answeredCount: axisMeta.EI.answeredCount,
      neutralCount: axisMeta.EI.neutralCount,
      totalWeight: axisMeta.EI.totalWeight,
      signedScore: axisMeta.EI.signedScore,
      isBorderline: shouldMarkLikertAxisAsBorderline({
        leftScore: raw.E,
        rightScore: raw.I,
        answeredCount: axisMeta.EI.answeredCount,
        neutralCount: axisMeta.EI.neutralCount,
        totalQuestionCount: questionsByAxis.EI,
        totalWeight: axisMeta.EI.totalWeight,
      }),
    }),
    SN: buildAxisScore({
      leftKey: "S",
      rightKey: "N",
      leftScore: raw.S,
      rightScore: raw.N,
      answeredCount: axisMeta.SN.answeredCount,
      neutralCount: axisMeta.SN.neutralCount,
      totalWeight: axisMeta.SN.totalWeight,
      signedScore: axisMeta.SN.signedScore,
      isBorderline: shouldMarkLikertAxisAsBorderline({
        leftScore: raw.S,
        rightScore: raw.N,
        answeredCount: axisMeta.SN.answeredCount,
        neutralCount: axisMeta.SN.neutralCount,
        totalQuestionCount: questionsByAxis.SN,
        totalWeight: axisMeta.SN.totalWeight,
      }),
    }),
    TF: buildAxisScore({
      leftKey: "T",
      rightKey: "F",
      leftScore: raw.T,
      rightScore: raw.F,
      answeredCount: axisMeta.TF.answeredCount,
      neutralCount: axisMeta.TF.neutralCount,
      totalWeight: axisMeta.TF.totalWeight,
      signedScore: axisMeta.TF.signedScore,
      isBorderline: shouldMarkLikertAxisAsBorderline({
        leftScore: raw.T,
        rightScore: raw.F,
        answeredCount: axisMeta.TF.answeredCount,
        neutralCount: axisMeta.TF.neutralCount,
        totalQuestionCount: questionsByAxis.TF,
        totalWeight: axisMeta.TF.totalWeight,
      }),
    }),
    JP: buildAxisScore({
      leftKey: "J",
      rightKey: "P",
      leftScore: raw.J,
      rightScore: raw.P,
      answeredCount: axisMeta.JP.answeredCount,
      neutralCount: axisMeta.JP.neutralCount,
      totalWeight: axisMeta.JP.totalWeight,
      signedScore: axisMeta.JP.signedScore,
      isBorderline: shouldMarkLikertAxisAsBorderline({
        leftScore: raw.J,
        rightScore: raw.P,
        answeredCount: axisMeta.JP.answeredCount,
        neutralCount: axisMeta.JP.neutralCount,
        totalQuestionCount: questionsByAxis.JP,
        totalWeight: axisMeta.JP.totalWeight,
      }),
    }),
  };

  const typeCode =
    axisScores.EI.dominant +
    axisScores.SN.dominant +
    axisScores.TF.dominant +
    axisScores.JP.dominant;

  const ambiguityAxes = (Object.entries(axisScores) as Array<[MbtiAxisKey, AxisScore]>)
    .filter(([, score]) => score.isBorderline)
    .map(([axis]) => axis);

  return {
    typeCode,
    axisScores,
    ambiguityAxes,
  };
}

export function calculateBusinessType(
  questions: BusinessQuestion[],
  answers: BusinessAnswer[]
): BusinessResult {
  const answerMap = new Map(answers.map((item) => [item.questionId, item.answer]));
  const responseStyle = analyzeBinaryResponseStyle(answers);

  const questionsByAxis: Record<BusinessAxisKey, number> = {
    MP: 0,
    QR: 0,
    VT: 0,
    CS: 0,
  };

  for (const question of questions) {
    questionsByAxis[question.axis] += 1;
  }

  const raw = {
    M: 0,
    P: 0,
    Q: 0,
    R: 0,
    V: 0,
    T: 0,
    C: 0,
    S: 0,
  };

  const axisMeta: Record<
    BusinessAxisKey,
    {
      answeredCount: number;
      neutralCount: number;
      totalWeight: number;
      signedScore: number;
    }
  > = {
    MP: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    QR: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    VT: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
    CS: { answeredCount: 0, neutralCount: 0, totalWeight: 0, signedScore: 0 },
  };

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    if (!answer) continue;

    const axisPair = BUSINESS_AXIS_MAP[question.axis];
    const meta = axisMeta[question.axis];

    meta.answeredCount += 1;
    meta.totalWeight += question.weight;

    const adjustedWeight = getBinaryStyleAdjustedWeight({
      baseWeight: question.weight,
      style: responseStyle,
    });

    const aSupportsLeft = question.reverse === false;

    if (answer === "A") {
      if (aSupportsLeft) {
        raw[axisPair.left] += adjustedWeight;
        meta.signedScore += adjustedWeight;
      } else {
        raw[axisPair.right] += adjustedWeight;
        meta.signedScore -= adjustedWeight;
      }
    } else {
      if (aSupportsLeft) {
        raw[axisPair.right] += adjustedWeight;
        meta.signedScore -= adjustedWeight;
      } else {
        raw[axisPair.left] += adjustedWeight;
        meta.signedScore += adjustedWeight;
      }
    }
  }

  const axisScores: Record<BusinessAxisKey, AxisScore> = {
    MP: buildAxisScore({
      leftKey: "M",
      rightKey: "P",
      leftScore: raw.M,
      rightScore: raw.P,
      answeredCount: axisMeta.MP.answeredCount,
      neutralCount: axisMeta.MP.neutralCount,
      totalWeight: axisMeta.MP.totalWeight,
      signedScore: axisMeta.MP.signedScore,
      isBorderline: shouldMarkBinaryAxisAsBorderline({
        leftScore: raw.M,
        rightScore: raw.P,
        answeredCount: axisMeta.MP.answeredCount,
        totalQuestionCount: questionsByAxis.MP,
        totalWeight: axisMeta.MP.totalWeight,
      }),
    }),
    QR: buildAxisScore({
      leftKey: "Q",
      rightKey: "R",
      leftScore: raw.Q,
      rightScore: raw.R,
      answeredCount: axisMeta.QR.answeredCount,
      neutralCount: axisMeta.QR.neutralCount,
      totalWeight: axisMeta.QR.totalWeight,
      signedScore: axisMeta.QR.signedScore,
      isBorderline: shouldMarkBinaryAxisAsBorderline({
        leftScore: raw.Q,
        rightScore: raw.R,
        answeredCount: axisMeta.QR.answeredCount,
        totalQuestionCount: questionsByAxis.QR,
        totalWeight: axisMeta.QR.totalWeight,
      }),
    }),
    VT: buildAxisScore({
      leftKey: "V",
      rightKey: "T",
      leftScore: raw.V,
      rightScore: raw.T,
      answeredCount: axisMeta.VT.answeredCount,
      neutralCount: axisMeta.VT.neutralCount,
      totalWeight: axisMeta.VT.totalWeight,
      signedScore: axisMeta.VT.signedScore,
      isBorderline: shouldMarkBinaryAxisAsBorderline({
        leftScore: raw.V,
        rightScore: raw.T,
        answeredCount: axisMeta.VT.answeredCount,
        totalQuestionCount: questionsByAxis.VT,
        totalWeight: axisMeta.VT.totalWeight,
      }),
    }),
    CS: buildAxisScore({
      leftKey: "C",
      rightKey: "S",
      leftScore: raw.C,
      rightScore: raw.S,
      answeredCount: axisMeta.CS.answeredCount,
      neutralCount: axisMeta.CS.neutralCount,
      totalWeight: axisMeta.CS.totalWeight,
      signedScore: axisMeta.CS.signedScore,
      isBorderline: shouldMarkBinaryAxisAsBorderline({
        leftScore: raw.C,
        rightScore: raw.S,
        answeredCount: axisMeta.CS.answeredCount,
        totalQuestionCount: questionsByAxis.CS,
        totalWeight: axisMeta.CS.totalWeight,
      }),
    }),
  };

  const typeCode =
    axisScores.MP.dominant +
    axisScores.QR.dominant +
    axisScores.VT.dominant +
    axisScores.CS.dominant;

  const ambiguityAxes = (Object.entries(axisScores) as Array<
    [BusinessAxisKey, AxisScore]
  >)
    .filter(([, score]) => score.isBorderline)
    .map(([axis]) => axis);

  return {
    typeCode,
    axisScores,
    ambiguityAxes,
  };
}
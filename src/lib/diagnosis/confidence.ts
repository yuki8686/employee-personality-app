import type {
  AxisScore,
  BusinessAxisKey,
  BusinessDirection,
  BusinessLikertQuestion,
  BusinessResult,
  ConfidenceRank,
  ConfidenceResult,
  LikertAnswer,
  MbtiAxisKey,
  MbtiDirection,
  MbtiLikertQuestion,
  MbtiResult,
} from "@/lib/diagnosis/types";

type MbtiConfidenceInput = {
  result: MbtiResult;
  reverseQuestions: MbtiLikertQuestion[];
  reverseAnswers: LikertAnswer[];
  consistencyQuestions: MbtiLikertQuestion[];
  consistencyAnswers: LikertAnswer[];
};

type BusinessConfidenceInput = {
  result: BusinessResult;
  reverseQuestions: BusinessLikertQuestion[];
  reverseAnswers: LikertAnswer[];
  consistencyQuestions: BusinessLikertQuestion[];
  consistencyAnswers: LikertAnswer[];
};

const MBTI_DOMINANT_MAP: Record<
  MbtiAxisKey,
  (typeCode: string) => MbtiDirection
> = {
  EI: (typeCode) => typeCode[0] as MbtiDirection,
  SN: (typeCode) => typeCode[1] as MbtiDirection,
  TF: (typeCode) => typeCode[2] as MbtiDirection,
  JP: (typeCode) => typeCode[3] as MbtiDirection,
};

const BUSINESS_DOMINANT_MAP: Record<
  BusinessAxisKey,
  (typeCode: string) => BusinessDirection
> = {
  MP: (typeCode) => typeCode[0] as BusinessDirection,
  QR: (typeCode) => typeCode[1] as BusinessDirection,
  VT: (typeCode) => typeCode[2] as BusinessDirection,
  CS: (typeCode) => typeCode[3] as BusinessDirection,
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getConfidenceRank(score: number): ConfidenceRank {
  if (score >= 90) return "高";
  if (score >= 75) return "やや高";
  if (score >= 60) return "中";
  if (score >= 40) return "やや低";
  return "低";
}

function buildSummary(params: {
  rank: ConfidenceRank;
  reverseMismatchCount: number;
  consistencyMismatchCount: number;
  neutralAnswerCount: number;
  unansweredCount: number;
  label: "MBTI" | "Business";
}) {
  const {
    rank,
    reverseMismatchCount,
    consistencyMismatchCount,
    neutralAnswerCount,
    unansweredCount,
    label,
  } = params;

  if (rank === "高") {
    return `回答の整合性と軸の明瞭さが高く、${label}結果はかなり安定しています。`;
  }

  if (rank === "やや高") {
    return `全体として安定しています。少数の揺れはありますが、${label}結果は十分信頼できます。`;
  }

  if (rank === "中") {
    return `一定の傾向は見られますが、回答にやや迷いがあります。${label}結果は参考値として扱うのが自然です。`;
  }

  if (rank === "やや低") {
    return `回答の揺れや中立回答がやや多く、${label}結果の確信度は高くありません。再受験で精度が上がる可能性があります。`;
  }

  return `回答の整合性が低めです。reverse矛盾 ${reverseMismatchCount} 件 / consistency矛盾 ${consistencyMismatchCount} 件 / 中立 ${neutralAnswerCount} 件 / 未回答 ${unansweredCount} 件です。`;
}

function getAxisMarginRate(axisScore?: AxisScore) {
  if (!axisScore) return 0;

  const leftScore = axisScore.leftScore ?? 0;
  const rightScore = axisScore.rightScore ?? 0;
  const total = leftScore + rightScore;

  if (total === 0) return 0;
  return Math.abs(leftScore - rightScore) / total;
}

function getAxisClarityScore(axisScore?: AxisScore) {
  if (!axisScore) return 0;

  const marginRate = getAxisMarginRate(axisScore);
  const answeredCount = axisScore.answeredCount ?? 0;
  const neutralRate = axisScore.neutralRate ?? 0;

  let score = marginRate * 100;

  if (axisScore.isBorderline) {
    score *= 0.72;
  }

  if (answeredCount <= 2) {
    score *= 0.6;
  } else if (answeredCount <= 4) {
    score *= 0.8;
  }

  if (neutralRate >= 0.5) {
    score *= 0.72;
  } else if (neutralRate >= 0.35) {
    score *= 0.84;
  } else if (neutralRate >= 0.2) {
    score *= 0.92;
  }

  return round(Math.max(0, Math.min(100, score)));
}

function getAxisCoverageScore(axisScore?: AxisScore) {
  if (!axisScore) return 0;

  const totalWeight = axisScore.totalWeight ?? 0;
  if (totalWeight <= 0) return 0;

  const leftScore = axisScore.leftScore ?? 0;
  const rightScore = axisScore.rightScore ?? 0;
  const evidence = leftScore + rightScore;
  const coverageRate = evidence / totalWeight;

  return round(Math.max(0, Math.min(100, coverageRate * 100)));
}

function evaluateLikertMismatch(params: {
  answer: number;
  dominantMatchesDirection: boolean;
}) {
  const { answer, dominantMatchesDirection } = params;

  const agreesWithDirection = answer >= 4;
  const disagreesWithDirection = answer <= 2;

  const isMismatch =
    (!dominantMatchesDirection && agreesWithDirection) ||
    (dominantMatchesDirection && disagreesWithDirection);

  if (!isMismatch) {
    return { isMismatch: false, severity: 0 as const };
  }

  if (answer === 5 || answer === 1) {
    return { isMismatch: true, severity: 2 as const };
  }

  return { isMismatch: true, severity: 1 as const };
}

function getMismatchQualityScore(params: {
  totalQuestionCount: number;
  mismatchCount: number;
  severeMismatchCount: number;
  unansweredCount: number;
}) {
  const { totalQuestionCount, mismatchCount, severeMismatchCount, unansweredCount } =
    params;

  if (totalQuestionCount === 0) {
    return 100;
  }

  const mildMismatchCount = Math.max(0, mismatchCount - severeMismatchCount);

  let score = 100;
  score -= (mildMismatchCount / totalQuestionCount) * 35;
  score -= (severeMismatchCount / totalQuestionCount) * 55;
  score -= (unansweredCount / totalQuestionCount) * 30;

  return round(Math.max(0, Math.min(100, score)));
}

function getNeutralQualityScore(neutralCount: number, totalQuestionCount: number) {
  if (totalQuestionCount === 0) {
    return 100;
  }

  const neutralRate = neutralCount / totalQuestionCount;

  let score = 100;
  if (neutralRate > 0.65) {
    score -= 42;
  } else if (neutralRate > 0.5) {
    score -= 28;
  } else if (neutralRate > 0.35) {
    score -= 16;
  } else if (neutralRate > 0.22) {
    score -= 8;
  }

  return round(Math.max(0, Math.min(100, score)));
}

function getAmbiguityScore(ambiguityCount: number, axisCount: number) {
  if (axisCount === 0) return 100;

  const rate = ambiguityCount / axisCount;
  let score = 100;

  if (rate >= 1) {
    score = 35;
  } else if (rate >= 0.75) {
    score = 48;
  } else if (rate >= 0.5) {
    score = 64;
  } else if (rate >= 0.25) {
    score = 82;
  }

  return score;
}

function buildAxisPenaltySummary<TAxis extends string>(
  axisScores: Record<TAxis, AxisScore>
) {
  const axisEntries = Object.keys(axisScores) as TAxis[];
  const scores: AxisScore[] = axisEntries.map((axis) => axisScores[axis]);

  if (scores.length === 0) {
    return {
      clarityAverage: 0,
      coverageAverage: 0,
      borderlineCount: 0,
    };
  }

  const clarityAverage =
    scores.reduce((sum: number, score: AxisScore) => {
      return sum + getAxisClarityScore(score);
    }, 0) / scores.length;

  const coverageAverage =
    scores.reduce((sum: number, score: AxisScore) => {
      return sum + getAxisCoverageScore(score);
    }, 0) / scores.length;

  const borderlineCount = scores.filter((score) => score.isBorderline).length;

  return {
    clarityAverage: round(clarityAverage),
    coverageAverage: round(coverageAverage),
    borderlineCount,
  };
}

function calculateFinalConfidenceScore(params: {
  clarityAverage: number;
  coverageAverage: number;
  reverseQualityScore: number;
  consistencyQualityScore: number;
  neutralQualityScore: number;
  ambiguityScore: number;
  severeMismatchCount: number;
}) {
  const {
    clarityAverage,
    coverageAverage,
    reverseQualityScore,
    consistencyQualityScore,
    neutralQualityScore,
    ambiguityScore,
    severeMismatchCount,
  } = params;

  let score =
    clarityAverage * 0.34 +
    coverageAverage * 0.14 +
    reverseQualityScore * 0.2 +
    consistencyQualityScore * 0.2 +
    neutralQualityScore * 0.07 +
    ambiguityScore * 0.05;

  if (severeMismatchCount >= 6) {
    score -= 9;
  } else if (severeMismatchCount >= 4) {
    score -= 6;
  } else if (severeMismatchCount >= 2) {
    score -= 3;
  }

  return clampScore(score);
}

export function calculateMbtiConfidence(
  input: MbtiConfidenceInput
): ConfidenceResult {
  const {
    result,
    reverseQuestions,
    reverseAnswers,
    consistencyQuestions,
    consistencyAnswers,
  } = input;

  const reverseAnswerMap = new Map(
    reverseAnswers.map((item) => [item.questionId, item.value])
  );
  const consistencyAnswerMap = new Map(
    consistencyAnswers.map((item) => [item.questionId, item.value])
  );

  let reverseMismatchCount = 0;
  let consistencyMismatchCount = 0;
  let neutralAnswerCount = 0;
  let unansweredCount = 0;
  let severeReverseMismatchCount = 0;
  let severeConsistencyMismatchCount = 0;

  for (const question of reverseQuestions) {
    const answer = reverseAnswerMap.get(question.id);
    const axis = question.axis;
    const dominant = MBTI_DOMINANT_MAP[axis](result.typeCode);

    if (answer == null) {
      unansweredCount += 1;
      continue;
    }

    if (answer === 3) {
      neutralAnswerCount += 1;
      continue;
    }

    const dominantMatchesDirection = dominant === question.direction;
    const mismatch = evaluateLikertMismatch({
      answer,
      dominantMatchesDirection,
    });

    if (mismatch.isMismatch) {
      reverseMismatchCount += 1;
      if (mismatch.severity === 2) {
        severeReverseMismatchCount += 1;
      }
    }
  }

  for (const question of consistencyQuestions) {
    const answer = consistencyAnswerMap.get(question.id);
    const axis = question.axis;
    const dominant = MBTI_DOMINANT_MAP[axis](result.typeCode);

    if (answer == null) {
      unansweredCount += 1;
      continue;
    }

    if (answer === 3) {
      neutralAnswerCount += 1;
      continue;
    }

    const dominantMatchesDirection = dominant === question.direction;
    const mismatch = evaluateLikertMismatch({
      answer,
      dominantMatchesDirection,
    });

    if (mismatch.isMismatch) {
      consistencyMismatchCount += 1;
      if (mismatch.severity === 2) {
        severeConsistencyMismatchCount += 1;
      }
    }
  }

  const axisSummary = buildAxisPenaltySummary(result.axisScores);

  const reverseAnsweredCount = reverseAnswers.filter(
    (item) => item.value >= 1 && item.value <= 5
  ).length;

  const consistencyAnsweredCount = consistencyAnswers.filter(
    (item) => item.value >= 1 && item.value <= 5
  ).length;

  const reverseQualityScore = getMismatchQualityScore({
    totalQuestionCount: reverseQuestions.length,
    mismatchCount: reverseMismatchCount,
    severeMismatchCount: severeReverseMismatchCount,
    unansweredCount: Math.max(0, reverseQuestions.length - reverseAnsweredCount),
  });

  const consistencyQualityScore = getMismatchQualityScore({
    totalQuestionCount: consistencyQuestions.length,
    mismatchCount: consistencyMismatchCount,
    severeMismatchCount: severeConsistencyMismatchCount,
    unansweredCount: Math.max(
      0,
      consistencyQuestions.length - consistencyAnsweredCount
    ),
  });

  const totalLikertCount = reverseQuestions.length + consistencyQuestions.length;
  const neutralQualityScore = getNeutralQualityScore(
    neutralAnswerCount,
    totalLikertCount
  );

  const ambiguityScore = getAmbiguityScore(
    result.ambiguityAxes.length,
    Object.keys(result.axisScores).length
  );

  const severeMismatchCount =
    severeReverseMismatchCount + severeConsistencyMismatchCount;

  const score = calculateFinalConfidenceScore({
    clarityAverage: axisSummary.clarityAverage,
    coverageAverage: axisSummary.coverageAverage,
    reverseQualityScore,
    consistencyQualityScore,
    neutralQualityScore,
    ambiguityScore,
    severeMismatchCount,
  });

  const rank = getConfidenceRank(score);

  return {
    score,
    rank,
    summary: buildSummary({
      rank,
      reverseMismatchCount,
      consistencyMismatchCount,
      neutralAnswerCount,
      unansweredCount,
      label: "MBTI",
    }),
    detail: {
      reverseMismatchCount,
      consistencyMismatchCount,
      neutralAnswerCount,
      unansweredCount,
    },
  };
}

export function calculateBusinessConfidence(
  input: BusinessConfidenceInput
): ConfidenceResult {
  const {
    result,
    reverseQuestions,
    reverseAnswers,
    consistencyQuestions,
    consistencyAnswers,
  } = input;

  const reverseAnswerMap = new Map(
    reverseAnswers.map((item) => [item.questionId, item.value])
  );
  const consistencyAnswerMap = new Map(
    consistencyAnswers.map((item) => [item.questionId, item.value])
  );

  let reverseMismatchCount = 0;
  let consistencyMismatchCount = 0;
  let neutralAnswerCount = 0;
  let unansweredCount = 0;
  let severeReverseMismatchCount = 0;
  let severeConsistencyMismatchCount = 0;

  for (const question of reverseQuestions) {
    const answer = reverseAnswerMap.get(question.id);
    const axis = question.axis;
    const dominant = BUSINESS_DOMINANT_MAP[axis](result.typeCode);

    if (answer == null) {
      unansweredCount += 1;
      continue;
    }

    if (answer === 3) {
      neutralAnswerCount += 1;
      continue;
    }

    const dominantMatchesDirection = dominant === question.direction;
    const mismatch = evaluateLikertMismatch({
      answer,
      dominantMatchesDirection,
    });

    if (mismatch.isMismatch) {
      reverseMismatchCount += 1;
      if (mismatch.severity === 2) {
        severeReverseMismatchCount += 1;
      }
    }
  }

  for (const question of consistencyQuestions) {
    const answer = consistencyAnswerMap.get(question.id);
    const axis = question.axis;
    const dominant = BUSINESS_DOMINANT_MAP[axis](result.typeCode);

    if (answer == null) {
      unansweredCount += 1;
      continue;
    }

    if (answer === 3) {
      neutralAnswerCount += 1;
      continue;
    }

    const dominantMatchesDirection = dominant === question.direction;
    const mismatch = evaluateLikertMismatch({
      answer,
      dominantMatchesDirection,
    });

    if (mismatch.isMismatch) {
      consistencyMismatchCount += 1;
      if (mismatch.severity === 2) {
        severeConsistencyMismatchCount += 1;
      }
    }
  }

  const axisSummary = buildAxisPenaltySummary(result.axisScores);

  const reverseAnsweredCount = reverseAnswers.filter(
    (item) => item.value >= 1 && item.value <= 5
  ).length;

  const consistencyAnsweredCount = consistencyAnswers.filter(
    (item) => item.value >= 1 && item.value <= 5
  ).length;

  const reverseQualityScore = getMismatchQualityScore({
    totalQuestionCount: reverseQuestions.length,
    mismatchCount: reverseMismatchCount,
    severeMismatchCount: severeReverseMismatchCount,
    unansweredCount: Math.max(0, reverseQuestions.length - reverseAnsweredCount),
  });

  const consistencyQualityScore = getMismatchQualityScore({
    totalQuestionCount: consistencyQuestions.length,
    mismatchCount: consistencyMismatchCount,
    severeMismatchCount: severeConsistencyMismatchCount,
    unansweredCount: Math.max(
      0,
      consistencyQuestions.length - consistencyAnsweredCount
    ),
  });

  const totalLikertCount = reverseQuestions.length + consistencyQuestions.length;
  const neutralQualityScore = getNeutralQualityScore(
    neutralAnswerCount,
    totalLikertCount
  );

  const ambiguityScore = getAmbiguityScore(
    result.ambiguityAxes.length,
    Object.keys(result.axisScores).length
  );

  const severeMismatchCount =
    severeReverseMismatchCount + severeConsistencyMismatchCount;

  const score = calculateFinalConfidenceScore({
    clarityAverage: axisSummary.clarityAverage,
    coverageAverage: axisSummary.coverageAverage,
    reverseQualityScore,
    consistencyQualityScore,
    neutralQualityScore,
    ambiguityScore,
    severeMismatchCount,
  });

  const rank = getConfidenceRank(score);

  return {
    score,
    rank,
    summary: buildSummary({
      rank,
      reverseMismatchCount,
      consistencyMismatchCount,
      neutralAnswerCount,
      unansweredCount,
      label: "Business",
    }),
    detail: {
      reverseMismatchCount,
      consistencyMismatchCount,
      neutralAnswerCount,
      unansweredCount,
    },
  };
}
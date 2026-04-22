export type MbtiAxisKey = "EI" | "SN" | "TF" | "JP";
export type BusinessAxisKey = "MP" | "QR" | "VT" | "CS";

export type MbtiDirection =
  | "E"
  | "I"
  | "S"
  | "N"
  | "T"
  | "F"
  | "J"
  | "P";

export type BusinessDirection =
  | "M"
  | "P"
  | "Q"
  | "R"
  | "V"
  | "T"
  | "C"
  | "S";

export type AxisDirection = MbtiDirection | BusinessDirection;

export type LikertValue = 1 | 2 | 3 | 4 | 5;
export type BinaryAnswer = "A" | "B";

export type MbtiQuestion = {
  id: string;
  text: string;
  axis: MbtiAxisKey;
  weight: number;
  reverse: boolean;
};

export type BusinessQuestion = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  axis: BusinessAxisKey;
  weight: number;
  reverse: boolean;
};

export type MbtiLikertQuestion = {
  id: string;
  axis: MbtiAxisKey;
  direction: MbtiDirection;
  question: string;
};

export type BusinessLikertQuestion = {
  id: string;
  axis: BusinessAxisKey;
  direction: BusinessDirection;
  question: string;
};

export type MbtiAnswer = {
  questionId: string;
  value: LikertValue;
};

export type BusinessAnswer = {
  questionId: string;
  answer: BinaryAnswer;
};

export type LikertAnswer = {
  questionId: string;
  value: LikertValue;
};

/**
 * 診断エンジン標準の軸スコア
 * 左方向を +、右方向を - とみなして扱えるように設計
 */
export type AxisScore = {
  leftKey: AxisDirection;
  rightKey: AxisDirection;

  leftScore: number;
  rightScore: number;

  leftRatio: number;
  rightRatio: number;

  difference: number;
  dominant: AxisDirection;
  isBorderline: boolean;

  answeredCount: number;
  neutralCount: number;
  neutralRate: number;

  totalWeight: number;

  /**
   * 左を +、右を - とした符号付きスコア
   */
  signedScore: number;
};

export type MbtiResult = {
  typeCode: string;
  axisScores: Record<MbtiAxisKey, AxisScore>;
  ambiguityAxes: MbtiAxisKey[];
};

export type BusinessResult = {
  typeCode: string;
  axisScores: Record<BusinessAxisKey, AxisScore>;
  ambiguityAxes: BusinessAxisKey[];
};

export type ConfidenceRank = "高" | "やや高" | "中" | "やや低" | "低";

export type ConfidenceDetail = {
  reverseMismatchCount: number;
  consistencyMismatchCount: number;
  neutralAnswerCount: number;
  unansweredCount: number;
};

export type ConfidenceResult = {
  score: number;
  rank: ConfidenceRank;
  summary: string;
  detail: ConfidenceDetail;
};
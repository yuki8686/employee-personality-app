import {
  businessConsistencyQuestions,
  businessQuestions,
  businessReverseQuestions,
  mbtiConsistencyQuestions,
  mbtiQuestions,
  mbtiReverseQuestions,
} from "@/lib/diagnosis/master";
import {
  calculateBusinessType,
  calculateMbtiType,
} from "@/lib/diagnosis/calculators";
import {
  calculateBusinessConfidence,
  calculateMbtiConfidence,
} from "@/lib/diagnosis/confidence";
import type {
  BinaryAnswer,
  BusinessAnswer,
  LikertAnswer,
  LikertValue,
  MbtiAnswer,
} from "@/lib/diagnosis/types";

function toLikertValue(value: number): LikertValue | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return null;
}

function toBinaryAnswer(value: number): BinaryAnswer | null {
  if (value === 1 || value === 2) {
    return "A";
  }
  if (value === -1 || value === -2) {
    return "B";
  }
  return null;
}

function mapMbtiAnswers(
  answers: Record<string, number>,
  questionIds?: string[]
): MbtiAnswer[] {
  const filteredIds = questionIds ? new Set(questionIds) : null;

  return Object.entries(answers)
    .filter(([questionId]) => {
      if (!filteredIds) return true;
      return filteredIds.has(questionId);
    })
    .map(([questionId, rawValue]) => {
      const value = toLikertValue(rawValue);
      if (value == null) return null;
      return {
        questionId,
        value,
      } satisfies MbtiAnswer;
    })
    .filter((item): item is MbtiAnswer => item !== null);
}

function mapLikertAnswers(
  answers: Record<string, number>,
  questionIds?: string[]
): LikertAnswer[] {
  const filteredIds = questionIds ? new Set(questionIds) : null;

  return Object.entries(answers)
    .filter(([questionId]) => {
      if (!filteredIds) return true;
      return filteredIds.has(questionId);
    })
    .map(([questionId, rawValue]) => {
      const value = toLikertValue(rawValue);
      if (value == null) return null;
      return {
        questionId,
        value,
      } satisfies LikertAnswer;
    })
    .filter((item): item is LikertAnswer => item !== null);
}

function mapBusinessAnswers(
  answers: Record<string, number>,
  questionIds?: string[]
): BusinessAnswer[] {
  const filteredIds = questionIds ? new Set(questionIds) : null;

  return Object.entries(answers)
    .filter(([questionId]) => {
      if (!filteredIds) return true;
      return filteredIds.has(questionId);
    })
    .map(([questionId, rawValue]) => {
      const answer = toBinaryAnswer(rawValue);
      if (answer == null) return null;
      return {
        questionId,
        answer,
      } satisfies BusinessAnswer;
    })
    .filter((item): item is BusinessAnswer => item !== null);
}

function buildMbtiStrengths(type: string): string[] {
  const map: Record<string, string[]> = {
    ISTJ: ["責任感が強い", "安定した進行が得意", "抜け漏れを防ぎやすい"],
    ISFJ: ["周囲への配慮が厚い", "支援が丁寧", "継続力がある"],
    INFJ: ["本質を捉えやすい", "洞察力が高い", "意味づけが得意"],
    INTJ: ["戦略設計が得意", "先を見通しやすい", "論理的に組み立てられる"],
    ISTP: ["冷静に状況判断できる", "実務対応が早い", "無駄を減らしやすい"],
    ISFP: ["柔軟に寄り添える", "場の空気を整えやすい", "誠実に向き合える"],
    INFP: ["価値観を大切にできる", "共感力が高い", "内省が深い"],
    INTP: ["構造理解が得意", "仮説思考に強い", "改善案を出しやすい"],
    ESTP: ["即断即決が得意", "現場対応が早い", "推進力がある"],
    ESFP: ["周囲を明るく巻き込める", "反応が素早い", "実行に移しやすい"],
    ENFP: ["発想が豊か", "人を動かしやすい", "新しい可能性を広げやすい"],
    ENTP: ["議論が得意", "発想転換に強い", "突破口を作りやすい"],
    ESTJ: ["管理が得意", "判断が明快", "前に進める力が強い"],
    ESFJ: ["関係構築が上手い", "チーム運営に強い", "周囲を支えやすい"],
    ENFJ: ["巻き込み力が高い", "目的共有が得意", "人の成長を促しやすい"],
    ENTJ: ["リーダーシップが強い", "意思決定が早い", "戦略と実行をつなぎやすい"],
  };

  return map[type] || ["診断傾向に基づく強みがあります"];
}

function buildMbtiWeaknesses(type: string): string[] {
  const map: Record<string, string[]> = {
    ISTJ: ["変化への対応が硬くなることがある", "慎重すぎることがある"],
    ISFJ: ["抱え込みやすい", "自己主張が弱くなることがある"],
    INFJ: ["理想が高くなりやすい", "一人で考え込みやすい"],
    INTJ: ["厳しく見られやすい", "説明が短くなりやすい"],
    ISTP: ["感情共有が少なく見えることがある", "独断に寄りやすい"],
    ISFP: ["判断を先延ばししやすい", "衝突を避けすぎることがある"],
    INFP: ["現実対応が遅れることがある", "傷つきやすい"],
    INTP: ["実行より思考に寄りやすい", "説明不足になりやすい"],
    ESTP: ["見切り発車になりやすい", "細部が抜けることがある"],
    ESFP: ["長期視点が弱くなることがある", "集中が散りやすい"],
    ENFP: ["広げすぎることがある", "着地が弱くなることがある"],
    ENTP: ["議論が先行しやすい", "最後まで詰めきれないことがある"],
    ESTJ: ["強く出すぎることがある", "柔軟性が弱く見えることがある"],
    ESFJ: ["周囲優先で疲れやすい", "嫌われる判断が苦手"],
    ENFJ: ["期待を背負いすぎやすい", "感情に引っ張られることがある"],
    ENTJ: ["圧が強く見えることがある", "相手のペースを待てないことがある"],
  };

  return map[type] || ["状況によって出やすい弱みがあります"];
}

function buildMbtiTraits(type: string): string[] {
  const map: Record<string, string[]> = {
    ISTJ: ["堅実", "実務型", "安定志向"],
    ISFJ: ["支援型", "丁寧", "継続型"],
    INFJ: ["洞察型", "理想志向", "静かな推進力"],
    INTJ: ["戦略型", "設計志向", "先読み型"],
    ISTP: ["冷静", "合理的", "現場対応型"],
    ISFP: ["柔和", "感覚派", "協調型"],
    INFP: ["価値観重視", "誠実", "内省型"],
    INTP: ["分析型", "仮説思考", "独創型"],
    ESTP: ["行動型", "即応型", "突破型"],
    ESFP: ["社交的", "場づくり型", "実行型"],
    ENFP: ["発想型", "巻き込み型", "拡張型"],
    ENTP: ["議論型", "着想型", "変革型"],
    ESTJ: ["統率型", "管理型", "実務推進型"],
    ESFJ: ["調整型", "対人支援型", "安定運営型"],
    ENFJ: ["育成型", "目的共有型", "共感推進型"],
    ENTJ: ["指揮型", "戦略推進型", "成果志向"],
  };

  return map[type] || ["個人特性があります"];
}

function buildBusinessTypeName(code: string) {
  const map: Record<string, string> = {
    MQVC: "先導ビジョン型",
    MRVC: "共創推進型",
    PQVC: "独立探究型",
    PRVC: "現場突破型",
    MQTC: "戦略統率型",
    MRTC: "成果管理型",
    PQTC: "高速実行型",
    PRTC: "機会捕捉型",
    MQVS: "品質構築型",
    MRVS: "信頼調整型",
    PQVS: "粘り強い職人型",
    PRVS: "現場支援型",
    MQTS: "守備設計型",
    MRTS: "安定生産型",
    PQTS: "堅実支援型",
    PRTS: "効率実務型",
  };

  return map[code] || code;
}

function buildBusinessSummary(code: string) {
  return `${buildBusinessTypeName(code)}の傾向があります。`;
}

function buildBusinessTips(code: string): string[] {
  const first = code[0] || "";
  const second = code[1] || "";
  const third = code[2] || "";
  const fourth = code[3] || "";

  const tips: string[] = [];

  if (first === "M") {
    tips.push("主導権や方向性を最初に明確にすると力を出しやすいです。");
  }
  if (first === "P") {
    tips.push("裁量や動きやすさを確保するとパフォーマンスが上がりやすいです。");
  }

  if (second === "Q") {
    tips.push("目的や理想像を先に共有すると納得感が高まりやすいです。");
  }
  if (second === "R") {
    tips.push("現実条件や役割分担を先に整理すると動きやすくなります。");
  }

  if (third === "V") {
    tips.push("意味づけや価値の説明があると判断しやすくなります。");
  }
  if (third === "T") {
    tips.push("事実と根拠を簡潔に示すと理解が早くなります。");
  }

  if (fourth === "C") {
    tips.push("計画性と安定した進行を用意すると安心して動けます。");
  }
  if (fourth === "S") {
    tips.push("スピード感と柔軟性を持たせると持ち味が出やすいです。");
  }

  return tips.slice(0, 3);
}

function buildBusinessCautions(code: string): string[] {
  const cautions: string[] = [];
  const first = code[0] || "";
  const second = code[1] || "";
  const fourth = code[3] || "";

  if (first === "M") cautions.push("意図せず強く見られることがあります。");
  if (first === "P") cautions.push("受け身に見られることがあります。");

  if (second === "Q") cautions.push("理想先行に見られることがあります。");
  if (second === "R") cautions.push("現実寄りで冷たく見られることがあります。");

  if (fourth === "C") cautions.push("慎重すぎて遅く見られることがあります。");
  if (fourth === "S") cautions.push("勢い優先で粗く見られることがあります。");

  return cautions.slice(0, 3);
}

export function calculateMbtiResult(answers: Record<string, number>) {
  const mainAnswers = mapMbtiAnswers(
    answers,
    mbtiQuestions.map((question) => question.id)
  );
  const reverseAnswers = mapLikertAnswers(
    answers,
    mbtiReverseQuestions.map((question) => question.id)
  );
  const consistencyAnswers = mapLikertAnswers(
    answers,
    mbtiConsistencyQuestions.map((question) => question.id)
  );

  const result = calculateMbtiType(mbtiQuestions, mainAnswers);
  const confidenceResult = calculateMbtiConfidence({
    result,
    reverseQuestions: mbtiReverseQuestions,
    reverseAnswers,
    consistencyQuestions: mbtiConsistencyQuestions,
    consistencyAnswers,
  });

  return {
    mbti: result.typeCode,
    typeCode: result.typeCode,
    axisResults: result.axisScores,
    axisScores: result.axisScores,
    ambiguityAxes: result.ambiguityAxes,
    confidence: confidenceResult.score,
    confidenceRank: confidenceResult.rank,
    confidenceSummary: confidenceResult.summary,
    confidenceDetail: confidenceResult.detail,
    strengths: buildMbtiStrengths(result.typeCode),
    weaknesses: buildMbtiWeaknesses(result.typeCode),
    traits: buildMbtiTraits(result.typeCode),
  };
}

export function calculateBusinessResult(answers: Record<string, number>) {
  const mainAnswers = mapBusinessAnswers(
    answers,
    businessQuestions.map((question) => question.id)
  );
  const reverseAnswers = mapLikertAnswers(
    answers,
    businessReverseQuestions.map((question) => question.id)
  );
  const consistencyAnswers = mapLikertAnswers(
    answers,
    businessConsistencyQuestions.map((question) => question.id)
  );

  const result = calculateBusinessType(businessQuestions, mainAnswers);
  const confidenceResult = calculateBusinessConfidence({
    result,
    reverseQuestions: businessReverseQuestions,
    reverseAnswers,
    consistencyQuestions: businessConsistencyQuestions,
    consistencyAnswers,
  });

  return {
    businessCode: result.typeCode,
    typeCode: result.typeCode,
    businessTypeName: buildBusinessTypeName(result.typeCode),
    axisResults: result.axisScores,
    axisScores: result.axisScores,
    ambiguityAxes: result.ambiguityAxes,
    confidence: confidenceResult.score,
    confidenceRank: confidenceResult.rank,
    confidenceSummary: confidenceResult.summary,
    confidenceDetail: confidenceResult.detail,
    summary: buildBusinessSummary(result.typeCode),
    communicationTips: buildBusinessTips(result.typeCode),
    cautions: buildBusinessCautions(result.typeCode),
  };
}
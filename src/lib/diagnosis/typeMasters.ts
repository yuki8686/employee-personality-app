export type MbtiCode =
  | "INTJ"
  | "INTP"
  | "ENTJ"
  | "ENTP"
  | "INFJ"
  | "INFP"
  | "ENFJ"
  | "ENFP"
  | "ISTJ"
  | "ISFJ"
  | "ESTJ"
  | "ESFJ"
  | "ISTP"
  | "ISFP"
  | "ESTP"
  | "ESFP";

export type BusinessCode =
  | "MQVC"
  | "MRVC"
  | "PQVC"
  | "PRVC"
  | "MQTC"
  | "MRTC"
  | "PQTC"
  | "PRTC"
  | "MQVS"
  | "MRVS"
  | "PQVS"
  | "PRVS"
  | "MQTS"
  | "MRTS"
  | "PQTS"
  | "PRTS";

export type MbtiProfile = {
  code: MbtiCode;
  nameJa: string;
  shortJa: string;
};

export type BusinessProfile = {
  code: BusinessCode;
  nameJa: string;
  subNameJa: string;
  groupJa: "挑戦型" | "戦略型" | "職人型" | "調和型";
};

export const MBTI_MASTER: Record<MbtiCode, MbtiProfile> = {
  INTJ: { code: "INTJ", nameJa: "建築家", shortJa: "戦略設計型" },
  INTP: { code: "INTP", nameJa: "論理学者", shortJa: "分析探究型" },
  ENTJ: { code: "ENTJ", nameJa: "指揮官", shortJa: "統率戦略型" },
  ENTP: { code: "ENTP", nameJa: "討論者", shortJa: "発想挑戦型" },
  INFJ: { code: "INFJ", nameJa: "提唱者", shortJa: "洞察理想型" },
  INFP: { code: "INFP", nameJa: "仲介者", shortJa: "共感信念型" },
  ENFJ: { code: "ENFJ", nameJa: "主人公", shortJa: "鼓舞牽引型" },
  ENFP: { code: "ENFP", nameJa: "広報運動家", shortJa: "共鳴創発型" },
  ISTJ: { code: "ISTJ", nameJa: "管理者", shortJa: "堅実管理型" },
  ISFJ: { code: "ISFJ", nameJa: "擁護者", shortJa: "献身支援型" },
  ESTJ: { code: "ESTJ", nameJa: "幹部", shortJa: "実務統括型" },
  ESFJ: { code: "ESFJ", nameJa: "領事", shortJa: "調和支援型" },
  ISTP: { code: "ISTP", nameJa: "巨匠", shortJa: "実践技巧型" },
  ISFP: { code: "ISFP", nameJa: "冒険家", shortJa: "感性表現型" },
  ESTP: { code: "ESTP", nameJa: "起業家", shortJa: "即応突破型" },
  ESFP: { code: "ESFP", nameJa: "エンターテイナー", shortJa: "場活性型" },
};

export const BUSINESS_MASTER: Record<BusinessCode, BusinessProfile> = {
  MQVC: {
    code: "MQVC",
    nameJa: "最前線キャプテン",
    subNameJa: "ビジョン駆動型フロントリーダー",
    groupJa: "挑戦型",
  },
  MRVC: {
    code: "MRVC",
    nameJa: "カリスマ監督",
    subNameJa: "人を動かす感情エンジニア",
    groupJa: "挑戦型",
  },
  PQVC: {
    code: "PQVC",
    nameJa: "没入ダイバー",
    subNameJa: "深海探査型プレイヤー",
    groupJa: "挑戦型",
  },
  PRVC: {
    code: "PRVC",
    nameJa: "火事場のエース",
    subNameJa: "切り札型プレイヤー",
    groupJa: "挑戦型",
  },
  MQTC: {
    code: "MQTC",
    nameJa: "戦略パイロット",
    subNameJa: "合理主義の参謀長",
    groupJa: "戦略型",
  },
  MRTC: {
    code: "MRTC",
    nameJa: "勝負師マネージャー",
    subNameJa: "数字と直感のハイブリッド",
    groupJa: "戦略型",
  },
  PQTC: {
    code: "PQTC",
    nameJa: "スピードスター",
    subNameJa: "試行回転数モンスター",
    groupJa: "戦略型",
  },
  PRTC: {
    code: "PRTC",
    nameJa: "勝ち筋ハンター",
    subNameJa: "機会嗅覚プレイヤー",
    groupJa: "戦略型",
  },
  MQVS: {
    code: "MQVS",
    nameJa: "ハイクオリティ軍師",
    subNameJa: "精度至上主義の設計参謀",
    groupJa: "職人型",
  },
  MRVS: {
    code: "MRVS",
    nameJa: "縁の下のパイセン",
    subNameJa: "信頼残高で組織を支える調整将軍",
    groupJa: "職人型",
  },
  PQVS: {
    code: "PQVS",
    nameJa: "コツコツクラフター",
    subNameJa: "再現性で勝つ静音エンジン",
    groupJa: "職人型",
  },
  PRVS: {
    code: "PRVS",
    nameJa: "場回しコンシェルジュ",
    subNameJa: "現場循環を整える実務司令塔",
    groupJa: "職人型",
  },
  MQTS: {
    code: "MQTS",
    nameJa: "最後の砦",
    subNameJa: "守備力全振りの危機管理責任者",
    groupJa: "調和型",
  },
  MRTS: {
    code: "MRTS",
    nameJa: "堅実プロデューサー",
    subNameJa: "現実解を出し続ける調整型統括",
    groupJa: "調和型",
  },
  PQTS: {
    code: "PQTS",
    nameJa: "信頼ガーディアン",
    subNameJa: "任務完遂の信頼装置",
    groupJa: "調和型",
  },
  PRTS: {
    code: "PRTS",
    nameJa: "タイパマスター",
    subNameJa: "効率至上の動線デザイナー",
    groupJa: "調和型",
  },
};

export function getBusinessTypeProfile(code?: string | null): BusinessProfile | null {
  if (!code) return null;
  return BUSINESS_MASTER[code as BusinessCode] ?? null;
}

export function getBusinessTypeName(code?: string | null): string {
  return getBusinessTypeProfile(code)?.nameJa ?? code ?? "-";
}

export function getBusinessTypeSubName(code?: string | null): string {
  return getBusinessTypeProfile(code)?.subNameJa ?? "-";
}

export function getBusinessTypeGroup(code?: string | null): string {
  return getBusinessTypeProfile(code)?.groupJa ?? "-";
}

export function getMbtiProfile(code?: string | null): MbtiProfile | null {
  if (!code) return null;
  return MBTI_MASTER[code as MbtiCode] ?? null;
}

export function getMbtiTypeName(code?: string | null): string {
  return getMbtiProfile(code)?.nameJa ?? code ?? "-";
}

export function getMbtiTypeShortName(code?: string | null): string {
  return getMbtiProfile(code)?.shortJa ?? "-";
}
import {
  getBusinessTypeName,
  getMbtiTypeName,
} from "@/lib/diagnosis/typeMasters";

export function getMbtiDisplayLabel(code?: string | null): string {
  const safeCode = code || "-";
  return `${safeCode} ${getMbtiTypeName(safeCode)}`;
}

export function getBusinessDisplayLabel(code?: string | null): string {
  const safeCode = code || "-";
  return `${safeCode} ${getBusinessTypeName(safeCode)}`;
}

export function getMbtiShortDescription(code?: string | null): string {
  switch (code) {
    case "INTJ":
      return "戦略と構造を重視し、先を見据えて設計するタイプです。";
    case "INTP":
      return "物事を深く分析し、仕組みや本質を理解しようとするタイプです。";
    case "ENTJ":
      return "ゴールから逆算し、周囲を動かしながら前進するタイプです。";
    case "ENTP":
      return "発想力と切り替えの速さで、新しい可能性を広げるタイプです。";
    case "INFJ":
      return "相手や状況の奥を読み取り、理想に向かって静かに進むタイプです。";
    case "INFP":
      return "自分の価値観を大切にしながら、納得できる形を追うタイプです。";
    case "ENFJ":
      return "人の力を引き出し、周囲を前向きに動かすタイプです。";
    case "ENFP":
      return "共感と発想で場を動かし、可能性を広げるタイプです。";
    case "ISTJ":
      return "事実と責任を重視し、堅実に積み上げるタイプです。";
    case "ISFJ":
      return "周囲を支えながら、安定した成果を丁寧に出すタイプです。";
    case "ESTJ":
      return "実務と管理の両面から、着実に前へ進めるタイプです。";
    case "ESFJ":
      return "周囲との調和を大切にしながら、実行を支えるタイプです。";
    case "ISTP":
      return "状況を冷静に見て、実践的に解決へ向かうタイプです。";
    case "ISFP":
      return "感性や価値観を大切にしながら、自分らしく動くタイプです。";
    case "ESTP":
      return "変化に素早く反応し、現場で結果をつかみに行くタイプです。";
    case "ESFP":
      return "人や場の空気をつかみ、明るく動きを生み出すタイプです。";
    default:
      return "現在の回答傾向から見えるMBTIタイプです。";
  }
}

export function getBusinessShortDescription(code?: string | null): string {
  switch (code) {
    case "MQVC":
      return "先頭に立って方向を示し、前に進める推進力が強いタイプです。";
    case "MRVC":
      return "人を動かしながら全体を前進させる統率力の高いタイプです。";
    case "PQVC":
      return "興味のある領域に深く入り込み、集中して成果を出すタイプです。";
    case "PRVC":
      return "現場で素早く動きながら答えをつかむ実戦型のタイプです。";
    case "MQTC":
      return "全体像と勝ち筋を描き、合理的に進める戦略型です。";
    case "MRTC":
      return "成果基準を明確にし、判断と推進を両立するタイプです。";
    case "PQTC":
      return "試行回数とスピードで前進する高速実行タイプです。";
    case "PRTC":
      return "機会を見つけて素早く取りに行く感覚に優れたタイプです。";
    case "MQVS":
      return "品質や理想を重視し、丁寧に設計する完成度重視タイプです。";
    case "MRVS":
      return "周囲との関係を整えながら、安定した推進を支えるタイプです。";
    case "PQVS":
      return "静かに積み上げながら、着実に精度を高めるタイプです。";
    case "PRVS":
      return "現場の流れを整え、実務を円滑に回すことに強いタイプです。";
    case "MQTS":
      return "安定運用と品質維持を重視し、土台を守るタイプです。";
    case "MRTS":
      return "現実的な判断で、無理なく成果を出す堅実なタイプです。";
    case "PQTS":
      return "誠実さと継続力で信頼を積み上げる安定型のタイプです。";
    case "PRTS":
      return "効率を重視し、続けやすい形へ最適化するタイプです。";
    default:
      return "現在の回答傾向から見えるビジネス人格タイプです。";
  }
}

export function getCombinedTypeDescription(params: {
  mbtiCode?: string | null;
  businessCode?: string | null;
}): string {
  const mbtiLabel = getMbtiDisplayLabel(params.mbtiCode);
  const businessLabel = getBusinessDisplayLabel(params.businessCode);
  const mbtiText = getMbtiShortDescription(params.mbtiCode);
  const businessText = getBusinessShortDescription(params.businessCode);

  return `${mbtiLabel}。${mbtiText} ${businessLabel}。${businessText}`;
}
export type AxisScore = {
  leftKey?: string;
  rightKey?: string;
  leftScore?: number;
  rightScore?: number;
  leftRatio?: number;
  rightRatio?: number;
  difference?: number;
  dominant?: string;
  isBorderline?: boolean;
  answeredCount?: number;
  neutralCount?: number;
  neutralRate?: number;
  totalWeight?: number;
  signedScore?: number;
};

export type GenerateInsightsParams = {
  mbti: string;
  business: string;
  mbtiTypeName?: string;
  businessTypeName?: string;
  mbtiAxes?: Record<string, AxisScore>;
  businessAxes?: Record<string, AxisScore>;
  mbtiAmbiguity?: string[];
  businessAmbiguity?: string[];
  mbtiConfidence?: number;
  businessConfidence?: number;
};

export type GeneratedInsights = {
  archetypeLabel: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  actions: string;
  communication: string;
  managerGuide: string;
  memberGuide: string;
};

function formatAxisLabel(axis: string) {
  if (axis === "EI") return "E / I";
  if (axis === "SN") return "S / N";
  if (axis === "TF") return "T / F";
  if (axis === "JP") return "J / P";
  if (axis === "MP") return "Manager / Player";
  if (axis === "QR") return "Quest / Reward";
  if (axis === "VT") return "Value / Terms";
  if (axis === "CS") return "Challenge / Safety";
  return axis;
}

function getAxisDominant(
  axes: Record<string, AxisScore> | undefined,
  axis: string,
  fallback?: string
) {
  return axes?.[axis]?.dominant || fallback || "";
}

function getWeakAxes(
  axes: Record<string, AxisScore> | undefined,
  max = 2
): string[] {
  return Object.entries(axes || {})
    .map(([axis, score]) => ({
      axis,
      difference: typeof score.difference === "number" ? score.difference : 999,
    }))
    .sort((a, b) => a.difference - b.difference)
    .slice(0, max)
    .map((item) => item.axis);
}

function getMbtiRoleTone(mbti: string) {
  const ei = mbti[0] || "";
  const sn = mbti[1] || "";
  const tf = mbti[2] || "";
  const jp = mbti[3] || "";

  const social =
    ei === "E" ? "人を巻き込みながら前に進める" : "一人で深く考えて質を高める";

  const concept =
    sn === "N" ? "抽象から方向性を描く" : "現実から確実に積み上げる";

  const judgment =
    tf === "T" ? "判断基準は論理と整合性" : "判断基準は人への影響と納得感";

  const pace =
    jp === "J" ? "進め方は計画的で締切志向" : "進め方は柔軟で適応志向";

  return { social, concept, judgment, pace, ei, sn, tf, jp };
}

function getBusinessRoleTone(
  business: string,
  axes?: Record<string, AxisScore>
) {
  const mp = getAxisDominant(axes, "MP", business[0]);
  const qr = getAxisDominant(axes, "QR", business[1]);
  const vt = getAxisDominant(axes, "VT", business[2]);
  const cs = getAxisDominant(axes, "CS", business[3]);

  const stance =
    mp === "M"
      ? "全体最適を見ながら役割や流れを整える"
      : "現場で手を動かしながら成果を形にする";

  const motive =
    qr === "Q"
      ? "自分の成長実感や達成感で火がつく"
      : "周囲への貢献実感や期待への応答で火がつく";

  const value =
    vt === "V"
      ? "意味や納得感があるほど粘り強くなれる"
      : "条件や再現性が整うほど安定して強い";

  const risk =
    cs === "C"
      ? "機会を見つけると先に踏み出しやすい"
      : "リスクを見極めながら確実に進めやすい";

  return { stance, motive, value, risk, mp, qr, vt, cs };
}

function getIntegratedArchetype(
  mbti: string,
  business: string,
  businessTypeName: string
) {
  const tf = mbti[2] || "";
  const jp = mbti[3] || "";
  const mp = business[0] || "";
  const cs = business[3] || "";

  if (mp === "M" && cs === "C" && tf === "T") return "戦略リーダー型";
  if (mp === "M" && cs === "S" && jp === "J") return "統率マネジメント型";
  if (mp === "P" && cs === "C" && tf === "T") return "突破実行型";
  if (mp === "P" && cs === "S" && (tf === "F" || jp === "P")) return "調整支援型";
  if (mp === "M") return `${businessTypeName}の司令塔型`;
  if (mp === "P") return `${businessTypeName}の現場推進型`;
  return "統合プロファイル";
}

function buildAmbiguityLine(
  mbtiAmbiguity: string[],
  businessAmbiguity: string[]
) {
  if (mbtiAmbiguity.length === 0 && businessAmbiguity.length === 0) return "";

  return `なお ${[...mbtiAmbiguity, ...businessAmbiguity]
    .map((axis) => formatAxisLabel(axis))
    .join(" / ")} は境界に近く、置かれる役割や相手によって振る舞いが変わりやすい領域です。`;
}

function buildConfidenceLine(
  mbtiConfidence?: number,
  businessConfidence?: number
) {
  if (typeof mbtiConfidence !== "number" || typeof businessConfidence !== "number") {
    return "";
  }

  return `診断の信頼度は MBTI ${mbtiConfidence}% / ビジネス人格 ${businessConfidence}% で、日常の実感と照らし合わせると解像度がさらに上がります。`;
}

function buildConflictText(params: {
  tf: string;
  jp: string;
  mp: string;
  cs: string;
  vt: string;
}) {
  const { tf, jp, mp, cs, vt } = params;

  const judgmentConflict =
    tf === "T"
      ? "人の感情より正しさを優先しやすく、感情的な納得を重視する相手とは温度差が出やすいです。"
      : "正しさだけで押されると気持ちが置いていかれやすく、論理先行の相手とは噛み合いにくい場面があります。";

  const paceConflict =
    jp === "J"
      ? "予定変更や曖昧な進行が続くと負荷が上がりやすく、柔軟運用を好む相手と衝突しやすいです。"
      : "自由度がない運用や細かい管理が続くと窮屈さを感じやすく、厳密な管理型の相手と摩擦が起きやすいです。";

  const roleConflict =
    mp === "M"
      ? "全体を整えようとするぶん、現場で即断即決したい相手からは干渉と受け取られることがあります。"
      : "現場で先に動くぶん、全体設計を重視する相手からは共有不足と見られることがあります。";

  const riskConflict =
    cs === "C"
      ? "スピードと挑戦を優先するため、慎重派とは『もう動くべきか、まだ整えるべきか』でぶつかりやすいです。"
      : "慎重に精度を上げるため、前進重視の相手とは『早く出すか、もっと整えるか』でぶつかりやすいです。";

  const valueConflict =
    vt === "V"
      ? "意味や納得感が薄い指示では熱量が下がりやすく、条件だけで動く相手と優先順位がずれることがあります。"
      : "条件や現実性が曖昧なまま進むと不安が高まりやすく、理想先行の相手と足並みがずれることがあります。";

  return `${judgmentConflict}${paceConflict}${roleConflict}${riskConflict}${valueConflict}`;
}

function buildRoleFitText(params: {
  mp: string;
  cs: string;
  qr: string;
  tf: string;
  sn: string;
}) {
  const { mp, cs, qr, tf, sn } = params;

  const roleA =
    mp === "M"
      ? "プロジェクトリードや方針整理役"
      : "現場推進役や実行オーナー";

  const roleB =
    cs === "C"
      ? "新規立ち上げや改善の初動役"
      : "運用安定化や品質管理役";

  const roleC =
    qr === "Q"
      ? "自分の裁量で伸びる専門推進ポジション"
      : "周囲支援や期待調整が求められるハブ役";

  const roleD =
    tf === "T"
      ? "課題整理、意思決定、優先順位設計"
      : "合意形成、関係調整、チーム支援";

  const roleE =
    sn === "N"
      ? "構想設計、企画、変化対応"
      : "運用設計、実務改善、再現性構築";

  return `このタイプが最も力を出しやすいのは、${roleA}、${roleB}、${roleC} です。加えて ${roleD} や ${roleE} が求められる場面では、本人の強みが成果に直結しやすくなります。`;
}

function buildNgActionText(params: {
  mp: string;
  cs: string;
  jp: string;
  vt: string;
}) {
  const { mp, cs, jp, vt } = params;

  const ng1 =
    mp === "M"
      ? "全部を自分で背負って抱え込むこと"
      : "共有なしで先に進めて独走すること";

  const ng2 =
    cs === "C"
      ? "周囲の準備度を見ずに一気に押し切ること"
      : "慎重さを優先しすぎて機会を逃すこと";

  const ng3 =
    jp === "J"
      ? "曖昧なままタスクを引き受け続けること"
      : "締切や期待値を曖昧なままにすること";

  const ng4 =
    vt === "V"
      ? "意味づけの薄い業務を惰性で抱え続けること"
      : "条件が曖昧なまま無理に走り出すこと";

  return `特に避けたいのは、${ng1}、${ng2}、${ng3}、${ng4} です。これが続くと本来の強みが圧や疲弊に変わりやすくなります。`;
}

function buildCommunicationText(params: {
  tf: string;
  jp: string;
  mp: string;
}) {
  const { tf, jp, mp } = params;

  const base =
    tf === "T"
      ? "会話では感情だけよりも、結論・根拠・影響範囲を整理して伝える方が噛み合います。"
      : "会話では正しさだけよりも、相手への影響や納得感も含めて伝える方が噛み合います。";

  const pace =
    jp === "J"
      ? "先にゴールと段取りを共有すると安心して力を出しやすいです。"
      : "先にゴールだけ握って進め方に余白を残すと力を出しやすいです。";

  const role =
    mp === "M"
      ? "相手に任せる時は、結論だけでなく意図と優先順位も渡すと再現性が上がります。"
      : "相手と進める時は、こまめな管理より期待値と締切を揃える方が機能します。";

  return `${base}${pace}${role}`;
}

function buildManagerGuide(params: {
  mp: string;
  vt: string;
  cs: string;
}) {
  const { mp, vt, cs } = params;

  const first =
    mp === "M"
      ? "上司として関わるなら、方針・優先順位・裁量範囲を先に渡したうえで任せるのが合います。"
      : "上司として関わるなら、ゴールと締切を明確にしたうえで、進め方には余白を残すのが合います。";

  const second =
    vt === "V"
      ? "意味や背景が見えると急に強くなるため、単なる指示よりも『なぜやるか』の説明が有効です。"
      : "条件や制約が明確だと動きやすいため、抽象的な期待よりも判断基準の明示が有効です。";

  const third =
    cs === "C"
      ? "勢いが出ている時ほど、止めるより優先順位を整える関わり方が向いています。"
      : "慎重に見ている時ほど、急かすより意思決定の期限を置く関わり方が向いています。";

  return `${first}${second}${third}`;
}

function buildMemberGuide(params: {
  tf: string;
  mp: string;
  jp: string;
}) {
  const { tf, mp, jp } = params;

  const first =
    mp === "M"
      ? "部下や同僚として関わるなら、結論に加えて背景と判断軸も共有すると噛み合いやすいです。"
      : "部下や同僚として関わるなら、細かい口出しより、目的と期待値を明確にする方が噛み合いやすいです。";

  const second =
    tf === "T"
      ? "説得する時は感情論よりも、事実・根拠・優先順位を整理して伝えるのが有効です。"
      : "説得する時は正論だけで押さず、相手や現場への影響まで含めて伝えるのが有効です。";

  const third =
    jp === "J"
      ? "相談は遅すぎるより早めが向いており、途中の不確定要素も先に見せる方が信頼されます。"
      : "相談は選択肢を複数持っていくと進めやすく、途中での方向転換も許容される設計が向いています。";

  return `${first}${second}${third}`;
}

export function buildMbtiCore(params: {
  mbtiCode: string;
  mbtiAxes?: Record<string, AxisScore>;
}) {
  const { mbtiCode, mbtiAxes } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "性格の核となる傾向はまだ取得できていません。";
  }

  const ei = mbtiAxes?.EI?.dominant || mbtiCode[0];
  const sn = mbtiAxes?.SN?.dominant || mbtiCode[1];

  const socialText =
    ei === "E"
      ? "外から刺激を受けるほどエネルギーが動きやすく"
      : "一人で整える時間があるほどエネルギーが回復しやすく";

  const perceptionText =
    sn === "N"
      ? "物事を可能性や意味の広がりで捉えやすいタイプです。"
      : "物事を現実性や具体性で捉えやすいタイプです。";

  return `${socialText}、${perceptionText}`;
}

export function buildMbtiEmotion(params: {
  mbtiCode: string;
  mbtiAxes?: Record<string, AxisScore>;
}) {
  const { mbtiCode, mbtiAxes } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "感情傾向の補足情報はまだありません。";
  }

  const tf = mbtiAxes?.TF?.dominant || mbtiCode[2];
  const jp = mbtiAxes?.JP?.dominant || mbtiCode[3];

  const judgmentText =
    tf === "F"
      ? "感情や人間関係の温度差に敏感で、空気の乱れを受け取りやすい傾向があります。"
      : "気持ちより筋道を優先しやすく、感情に流されにくいぶん冷たく見られることがあります。";

  const stressText =
    jp === "J"
      ? "不確定さや予定の乱れが続くと、内側の負荷が上がりやすいです。"
      : "決めつけられたり自由度が下がると、気持ちが詰まりやすいです。";

  return `${judgmentText}${stressText}`;
}

export function buildMbtiBlindSpot(params: {
  mbtiCode: string;
  mbtiAmbiguity: string[];
  mbtiAxes?: Record<string, AxisScore>;
  mbtiConfidence?: number;
}) {
  const { mbtiCode, mbtiAmbiguity, mbtiAxes, mbtiConfidence } = params;
  if (!mbtiCode || mbtiCode === "-") {
    return "見落としやすい傾向はまだ判定できていません。";
  }

  const weakAxes = Object.entries(mbtiAxes || {})
    .map(([axis, score]) => ({
      axis,
      difference: typeof score.difference === "number" ? score.difference : 0,
    }))
    .sort((a, b) => a.difference - b.difference)
    .slice(0, 2)
    .map((item) => item.axis);

  const ambiguityText =
    mbtiAmbiguity.length > 0
      ? `${mbtiAmbiguity.join(" / ")} は境界に近く、場面によって見え方が揺れやすいです。`
      : weakAxes.length > 0
        ? `${weakAxes.join(" / ")} は比較的差が小さく、状況で反応が変わりやすいです。`
        : "一部の軸は状況次第で表情が変わる可能性があります。";

  const confidenceText =
    typeof mbtiConfidence === "number" && mbtiConfidence < 70
      ? "今回の結果は参考値として受け取りつつ、自分の実感とも照らし合わせるのが向いています。"
      : "普段の自分と強いときの自分を分けて見ると、より解像度が上がります。";

  return `${ambiguityText}${confidenceText}`;
}

export function buildBusinessWorkStyle(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore>;
}) {
  const { businessCode, businessAxes } = params;
  if (!businessCode || businessCode === "-") {
    return "仕事スタイルの補足情報はまだありません。";
  }

  const mp = businessAxes?.MP?.dominant || businessCode[0];
  const cs = businessAxes?.CS?.dominant || businessCode[3];

  const stanceText =
    mp === "M"
      ? "全体を見ながら方向を整える動き方が得意で"
      : "現場で動きながら形にしていく動き方が得意で";

  const paceText =
    cs === "C"
      ? "比較的前に出て流れをつくりやすいタイプです。"
      : "安定や再現性を見ながら堅実に進めやすいタイプです。";

  return `${stanceText}、${paceText}`;
}

export function buildBusinessValueDriver(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore>;
}) {
  const { businessCode, businessAxes } = params;
  if (!businessCode || businessCode === "-") {
    return "価値観の補足情報はまだありません。";
  }

  const qr = businessAxes?.QR?.dominant || businessCode[1];
  const vt = businessAxes?.VT?.dominant || businessCode[2];

  const motiveText =
    qr === "Q"
      ? "自分の成長や達成実感が強い燃料になりやすく"
      : "人や組織に価値を返せている感覚が強い燃料になりやすく";

  const criteriaText =
    vt === "V"
      ? "納得感や意味づけがあるほど力を出しやすい傾向があります。"
      : "条件や現実性が整っているほど力を出しやすい傾向があります。";

  return `${motiveText}、${criteriaText}`;
}

export function buildBusinessBlindSpot(params: {
  businessCode: string;
  businessAxes?: Record<string, AxisScore>;
  businessAmbiguity: string[];
}) {
  const { businessCode, businessAxes, businessAmbiguity } = params;
  if (!businessCode || businessCode === "-") {
    return "見落としやすい傾向はまだ判定できていません。";
  }

  const mp = businessAxes?.MP?.dominant || businessCode[0];
  const cs = businessAxes?.CS?.dominant || businessCode[3];

  const baseText =
    mp === "M"
      ? "前に出て整えようとするぶん、抱え込みや圧の強さとして見られることがあります。"
      : "現場対応に強いぶん、全体設計や優先順位の共有が薄く見えることがあります。";

  const riskText =
    cs === "C"
      ? "勢いが強い時ほど周囲の準備度との差が出やすいです。"
      : "慎重さが強い時ほど、機会を逃したように見られることがあります。";

  const ambiguityText =
    businessAmbiguity.length > 0
      ? `${businessAmbiguity.join(" / ")} は状況によって揺れやすい軸です。`
      : "";

  return `${baseText}${riskText}${ambiguityText}`.trim();
}

export function generateInsights(
  params: GenerateInsightsParams
): GeneratedInsights {
  const {
    mbti,
    business,
    mbtiTypeName = "",
    businessTypeName = "",
    mbtiAxes,
    businessAxes,
    mbtiAmbiguity = [],
    businessAmbiguity = [],
    mbtiConfidence,
    businessConfidence,
  } = params;

  if (!mbti || mbti === "-" || !business || business === "-") {
    return {
      archetypeLabel: "統合分析待機中",
      summary:
        "MBTIまたはビジネス人格の診断データが不足しているため、統合分析はまだ生成できていません。",
      strengths:
        "強みの抽出には、MBTIとビジネス人格の両方が必要です。診断データが揃うと、役割適性と行動傾向をより立体的に分析できます。",
      weaknesses:
        "現在は診断情報が不足しているため、弱みや注意点を精密には判定できません。",
      actions:
        "まずは最新の診断結果を保存し、両方のタイプが表示されている状態で再度確認してください。",
      communication:
        "コミュニケーション指針は統合結果の取得後に生成されます。",
      managerGuide:
        "上司として関わる際のガイドは、統合データの取得後に生成されます。",
      memberGuide:
        "部下・同僚として関わる際のガイドは、統合データの取得後に生成されます。",
    };
  }

  const mbtiTone = getMbtiRoleTone(mbti);
  const businessTone = getBusinessRoleTone(business, businessAxes);
  const archetypeLabel = getIntegratedArchetype(mbti, business, businessTypeName);

  const weakMbtiAxes = getWeakAxes(mbtiAxes, 2);
  const weakBusinessAxes = getWeakAxes(businessAxes, 2);

  const ambiguityLine = buildAmbiguityLine(mbtiAmbiguity, businessAmbiguity);
  const confidenceLine = buildConfidenceLine(mbtiConfidence, businessConfidence);

  const summary = `${mbti} の「${mbtiTypeName}」と ${business} の「${businessTypeName}」を重ねると、このタイプは ${archetypeLabel} と言えます。${mbtiTone.social}一方で、${mbtiTone.concept}傾向があり、仕事では ${businessTone.stance} 動き方が自然です。さらに、${businessTone.motive}ため、${businessTone.value}状態ではパフォーマンスが大きく伸びます。結果として、構想と実務、個人の判断と組織の流れをつなぐハブになりやすいタイプです。${ambiguityLine}${confidenceLine}`;

  const strengths = `最大の強みは、${mbtiTone.social}ことと、${businessTone.stance}ことが同居している点です。つまり「考えるだけ」「動くだけ」に偏りにくく、役割に応じて前に出ることも支えることもできます。判断面では ${mbtiTone.judgment} ため、意思決定に軸がぶれにくく、周囲からは「任せた時の再現性が高い人」と見られやすいです。組織では、新規施策の立ち上げ、改善推進、複数人の調整が必要な場面で特に強さが出ます。${buildRoleFitText({
    mp: businessTone.mp,
    cs: businessTone.cs,
    qr: businessTone.qr,
    tf: mbtiTone.tf,
    sn: mbtiTone.sn,
  })}`;

  const weaknesses = `注意点は、強みがそのまま圧や抱え込みに変わりやすいことです。${businessTone.mp === "M" ? "全体を見ようとするほど自分で背負いすぎたり、周囲の速度差に苛立ちやすくなります。" : "現場で素早く動けるぶん、説明や合意形成が後ろに回り、独走して見えることがあります。"}また、${businessTone.cs === "C" ? "チャンスを見つけると先に踏み出せる反面、周囲の準備不足を置き去りにしやすいです。" : "慎重に整える反面、勝負どころで一歩目が遅いと見られることがあります。"} ${
    weakMbtiAxes.length > 0 || weakBusinessAxes.length > 0
      ? `${[...weakMbtiAxes, ...weakBusinessAxes]
          .map((axis) => formatAxisLabel(axis))
          .join(" / ")} は差が小さめなので、その日のコンディションや相手次第で判断がぶれたように見えることもあります。`
      : ""
  }${buildConflictText({
    tf: mbtiTone.tf,
    jp: mbtiTone.jp,
    mp: businessTone.mp,
    cs: businessTone.cs,
    vt: businessTone.vt,
  })}${buildNgActionText({
    mp: businessTone.mp,
    cs: businessTone.cs,
    jp: mbtiTone.jp,
    vt: businessTone.vt,
  })}`;

  const actions = `成長戦略としては、第一に「自分が強く出る場面」と「任せた方が強い場面」を切り分けることです。第二に、仕事を進める時は結論だけでなく「なぜその順番か」「どこまで任せたいか」を言語化すると、周囲の再現性が一気に上がります。第三に、${
    businessTone.qr === "Q"
      ? "成長欲求が燃料になりやすいので、自分だけが伸びる仕事に閉じず、チーム成果にどう接続するかを毎回整理すること。"
      : "貢献実感が燃料になりやすいので、頼まれごとを抱え込みすぎず、成果として見える形に残すこと。"
  }第四に、衝突が起きやすい論点を先回りして共有し、スピード・品質・役割分担のどれを優先するかを事前に揃えることです。`;

  const communication = buildCommunicationText({
    tf: mbtiTone.tf,
    jp: mbtiTone.jp,
    mp: businessTone.mp,
  });

  const managerGuide = buildManagerGuide({
    mp: businessTone.mp,
    vt: businessTone.vt,
    cs: businessTone.cs,
  });

  const memberGuide = buildMemberGuide({
    tf: mbtiTone.tf,
    mp: businessTone.mp,
    jp: mbtiTone.jp,
  });

  return {
    archetypeLabel,
    summary,
    strengths,
    weaknesses,
    actions,
    communication,
    managerGuide,
    memberGuide,
  };
}